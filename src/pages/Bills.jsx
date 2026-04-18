import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, Clock,
  Calendar, RefreshCw, ChevronDown, ChevronUp, Zap, CreditCard,
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import AmountDisplay from '../components/AmountDisplay';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency, formatDateShort, formatDate, daysUntil, today,
  overdueBills, upcomingBills,
} from '../lib/finance';

// ─── Constants ────────────────────────────────────────────────────────────────

const RECURRENCES = ['once', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual'];

const RECURRENCE_LABELS = {
  once: 'One-time', weekly: 'Weekly', monthly: 'Monthly',
  quarterly: 'Quarterly', biannual: 'Biannual', annual: 'Annual',
};

const CATEGORIES = [
  'Housing', 'Utilities', 'Insurance', 'Phone', 'Internet',
  'Credit Card', 'Medical', 'Loan', 'Car', 'Subscription', 'Other',
];

const EMPTY_FORM = {
  name: '', amount: '', due_date: '', recurrence: 'monthly',
  category: 'Utilities', autopay: false, notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urgencyColor(days) {
  if (days === null) return 'text-wb-muted';
  if (days < 0)   return 'text-wb-red';
  if (days <= 3)  return 'text-wb-red';
  if (days <= 7)  return 'text-wb-amber';
  return 'text-wb-green';
}

function DuePill({ days }) {
  if (days === null) return null;
  if (days < 0)  return <span className="text-xs font-bold text-wb-red bg-wb-red/10 px-2 py-0.5 rounded-full">{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="text-xs font-bold text-wb-red bg-wb-red/10 px-2 py-0.5 rounded-full">Due today</span>;
  if (days <= 3)  return <span className="text-xs font-bold text-wb-red bg-wb-red/10 px-2 py-0.5 rounded-full">In {days}d</span>;
  if (days <= 7)  return <span className="text-xs font-bold text-wb-amber bg-wb-amber/10 px-2 py-0.5 rounded-full">In {days}d</span>;
  return <span className="text-xs text-wb-muted bg-wb-border px-2 py-0.5 rounded-full">In {days}d</span>;
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-wb-blue' : 'bg-wb-border'
      }`}
      aria-checked={checked}
      role="switch"
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}

// ─── Bill Form Modal ──────────────────────────────────────────────────────────

function BillModal({ open, onClose, initial, onSave }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);

  // Reset on open
  const handleOpen = () => setForm(initial ?? EMPTY_FORM);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.amount || !form.due_date) return;
    onSave({ ...form, amount: parseFloat(form.amount), autopay: !!form.autopay });
  };

  const isEdit = !!initial?.id;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Bill' : 'Add Bill'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="label">Bill Name *</label>
          <input
            required type="text" placeholder="Rent, Electric, etc."
            value={form.name} onChange={e => set('name', e.target.value)}
          />
        </div>

        {/* Amount + Due Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount *</label>
            <input
              required type="number" min="0" step="0.01" placeholder="0.00"
              value={form.amount} onChange={e => set('amount', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Due Date *</label>
            <input
              required type="date"
              value={form.due_date} onChange={e => set('due_date', e.target.value)}
            />
          </div>
        </div>

        {/* Recurrence + Category */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Recurrence</label>
            <select value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
              {RECURRENCES.map(r => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea
            rows={2} placeholder="Optional notes..."
            value={form.notes} onChange={e => set('notes', e.target.value)}
            className="resize-none"
          />
        </div>

        {/* Autopay */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-wb-white">Autopay Enabled</p>
            <p className="text-xs text-wb-muted">Bill is paid automatically</p>
          </div>
          <Toggle checked={!!form.autopay} onChange={v => set('autopay', v)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1">Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ bills }) {
  const now = today();
  const thisMonth = now.slice(0, 7);

  const dueThisWeek = bills.filter(b => {
    if (b.status === 'paid') return false;
    const d = daysUntil(b.due_date);
    return d !== null && d >= 0 && d <= 7;
  });

  const upcoming = bills.filter(b => {
    if (b.status === 'paid') return false;
    const d = daysUntil(b.due_date);
    return d !== null && d > 7 && d <= 30;
  });

  const overdue = overdueBills(bills);

  const weekTotal   = dueThisWeek.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const upcomingTotal = upcoming.reduce((s, b) => s + (Number(b.amount) || 0), 0);

  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      {/* Due This Week */}
      <div className="card text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-wb-muted mb-1">This Week</p>
        <p className="text-xl font-bold text-wb-white">{dueThisWeek.length}</p>
        <p className="text-xs text-wb-amber font-medium mt-0.5 tabular-nums">
          {dueThisWeek.length > 0 ? formatCurrency(weekTotal, 'USD', true) : '—'}
        </p>
      </div>

      {/* Upcoming */}
      <div className="card text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-wb-muted mb-1">7–30d</p>
        <p className="text-xl font-bold text-wb-white">{upcoming.length}</p>
        <p className="text-xs text-wb-blue font-medium mt-0.5 tabular-nums">
          {upcoming.length > 0 ? formatCurrency(upcomingTotal, 'USD', true) : '—'}
        </p>
      </div>

      {/* Overdue */}
      <div className="card text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-wb-muted mb-1">Overdue</p>
        <p className={`text-xl font-bold ${overdue.length > 0 ? 'text-wb-red' : 'text-wb-muted'}`}>
          {overdue.length}
        </p>
        <p className={`text-xs font-medium mt-0.5 ${overdue.length > 0 ? 'text-wb-red' : 'text-wb-muted'}`}>
          {overdue.length > 0
            ? formatCurrency(overdue.reduce((s, b) => s + (Number(b.amount) || 0), 0), 'USD', true)
            : '—'}
        </p>
      </div>
    </div>
  );
}

// ─── Bill Card ────────────────────────────────────────────────────────────────

function BillCard({ bill, onEdit, onDelete, onMarkPaid, variant = 'normal' }) {
  const days = daysUntil(bill.due_date);
  const isOverdue  = variant === 'overdue';
  const isPaid     = bill.status === 'paid';

  const borderStyle = isOverdue
    ? 'border-wb-red/40 bg-wb-red/5'
    : 'border-wb-border bg-wb-card';

  return (
    <div className={`rounded-xl border p-4 mb-3 ${borderStyle}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isOverdue && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-wb-red text-white px-1.5 py-0.5 rounded">
                OVERDUE
              </span>
            )}
            <p className={`font-semibold text-sm ${isPaid ? 'line-through text-wb-muted' : 'text-wb-white'}`}>
              {bill.name}
            </p>
            {bill.autopay && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-wb-green bg-wb-green/10 px-1.5 py-0.5 rounded-full">
                <Zap size={8} /> Auto
              </span>
            )}
            {bill.recurrence && bill.recurrence !== 'once' && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-wb-muted bg-wb-border px-1.5 py-0.5 rounded">
                {RECURRENCE_LABELS[bill.recurrence]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-wb-muted mb-2">
            <Calendar size={11} />
            <span>{formatDateShort(bill.due_date)}</span>
            {!isPaid && (
              <>
                <span>·</span>
                <DuePill days={days} />
              </>
            )}
            {isPaid && bill.paid_date && (
              <>
                <span>·</span>
                <span className="text-wb-green text-xs">Paid {formatDateShort(bill.paid_date)}</span>
              </>
            )}
          </div>

          {bill.category && (
            <span className="text-[10px] text-wb-muted">{bill.category}</span>
          )}
          {bill.notes && (
            <p className="text-xs text-wb-muted mt-1 line-clamp-1">{bill.notes}</p>
          )}
        </div>

        {/* Right */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <p className={`text-base font-bold tabular-nums ${isOverdue ? 'text-wb-red' : 'text-wb-white'}`}>
            {formatCurrency(bill.amount)}
          </p>
          {!isPaid && (
            <button
              onClick={() => onMarkPaid(bill.id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-wb-green bg-wb-green/10 hover:bg-wb-green/20 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <CheckCircle2 size={12} /> Paid
            </button>
          )}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onEdit(bill)}
              className="p-1.5 rounded-lg text-wb-muted hover:text-wb-blue hover:bg-wb-blue/10 transition-colors"
              aria-label="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onDelete(bill.id)}
              className="p-1.5 rounded-lg text-wb-muted hover:text-wb-red hover:bg-wb-red/10 transition-colors"
              aria-label="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Paid This Month Collapsible ──────────────────────────────────────────────

function PaidSection({ bills, onEdit, onDelete, onMarkPaid }) {
  const [open, setOpen] = useState(false);
  const thisMonth = today().slice(0, 7);
  const paid = bills.filter(b => b.status === 'paid' && b.paid_date?.slice(0, 7) === thisMonth);

  if (!paid.length) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full py-2 text-wb-muted hover:text-wb-white transition-colors"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span className="label mb-0 normal-case text-sm font-medium">
          Paid This Month ({paid.length})
        </span>
        <span className="ml-auto text-xs tabular-nums">
          {formatCurrency(paid.reduce((s, b) => s + (Number(b.amount) || 0), 0))}
        </span>
      </button>

      {open && (
        <div className="mt-2 opacity-70">
          {paid.map(b => (
            <BillCard
              key={b.id}
              bill={b}
              onEdit={onEdit}
              onDelete={onDelete}
              onMarkPaid={onMarkPaid}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-wb-amber/10 flex items-center justify-center mb-4">
        <CreditCard size={28} className="text-wb-amber" />
      </div>
      <p className="text-lg font-semibold text-wb-white mb-1">No bills yet</p>
      <p className="text-sm text-wb-muted mb-6 max-w-xs">
        Stay on top of all your bill due dates and never miss a payment.
      </p>
      <button className="btn-primary" onClick={onAdd}>
        <Plus size={16} /> Add Bill
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Bills() {
  const { bills, addBill, updateBill, markBillPaid, deleteBill } = useFinance();

  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const openAdd  = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (bill) => { setEditTarget(bill); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = (data) => {
    if (editTarget) {
      updateBill(editTarget.id, data);
    } else {
      addBill(data);
    }
    closeModal();
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this bill?')) deleteBill(id);
  };

  // Categorize bills
  const overdueList = useMemo(() => overdueBills(bills), [bills]);

  const dueSoon = useMemo(() =>
    bills.filter(b => {
      if (b.status === 'paid') return false;
      const d = daysUntil(b.due_date);
      return d !== null && d >= 0 && d <= 14;
    }).sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date)),
  [bills]);

  const upcoming = useMemo(() =>
    bills.filter(b => {
      if (b.status === 'paid') return false;
      const d = daysUntil(b.due_date);
      return d !== null && d > 14 && d <= 45;
    }).sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date)),
  [bills]);

  const sharedProps = { onEdit: openEdit, onDelete: handleDelete, onMarkPaid: markBillPaid };

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="page-header mb-0">Bills</h1>
          <button className="btn-primary text-sm py-2 px-4" onClick={openAdd}>
            <Plus size={15} /> Add
          </button>
        </div>

        {bills.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <>
            {/* Status Summary */}
            <SummaryCards bills={bills} />

            {/* Overdue */}
            {overdueList.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-wb-red" />
                  <p className="section-title text-wb-red text-sm">Overdue</p>
                  <span className="text-xs bg-wb-red text-white px-1.5 py-0.5 rounded-full font-bold">
                    {overdueList.length}
                  </span>
                </div>
                {overdueList.map(b => (
                  <BillCard key={b.id} bill={b} variant="overdue" {...sharedProps} />
                ))}
              </div>
            )}

            {/* Due Soon (≤14d) */}
            {dueSoon.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-wb-amber" />
                  <p className="label mb-0 normal-case text-sm font-semibold text-wb-white">
                    Due Soon
                  </p>
                </div>
                {dueSoon.map(b => (
                  <BillCard key={b.id} bill={b} {...sharedProps} />
                ))}
              </div>
            )}

            {/* Upcoming (14–45d) */}
            {upcoming.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={14} className="text-wb-blue" />
                  <p className="label mb-0 normal-case text-sm font-semibold text-wb-white">
                    Upcoming
                  </p>
                </div>
                <div className="opacity-90">
                  {upcoming.map(b => (
                    <BillCard key={b.id} bill={b} {...sharedProps} />
                  ))}
                </div>
              </div>
            )}

            {/* Paid This Month */}
            <PaidSection bills={bills} {...sharedProps} />

            {/* If all bills are paid this month and no other sections */}
            {overdueList.length === 0 && dueSoon.length === 0 && upcoming.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center">
                <CheckCircle2 size={36} className="text-wb-green mb-3" />
                <p className="font-semibold text-wb-white">All caught up!</p>
                <p className="text-sm text-wb-muted mt-1">No bills due in the next 45 days.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      <BillModal
        open={modalOpen}
        onClose={closeModal}
        initial={editTarget ? { ...editTarget, amount: String(editTarget.amount) } : null}
        onSave={handleSave}
      />
    </Layout>
  );
}
