import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, RefreshCw, TrendingUp, Calendar,
  ChevronRight, Zap, ToggleLeft, ToggleRight, Tag,
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ProgressBar from '../components/ProgressBar';
import AmountDisplay from '../components/AmountDisplay';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency, formatDateShort, daysUntil, today,
  monthlyEquivalent, upcomingSubscriptions, uuid,
} from '../lib/finance';

// ─── Constants ────────────────────────────────────────────────────────────────

const BILLING_CYCLES = ['weekly', 'monthly', 'quarterly', 'biannual', 'annual'];

const CATEGORIES = [
  'Entertainment', 'Streaming', 'Music', 'Productivity',
  'Health & Fitness', 'News & Media', 'Gaming', 'Shopping',
  'Cloud Storage', 'Education', 'Software', 'Other',
];

const CYCLE_LABELS = {
  weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly',
  biannual: 'Biannual', annual: 'Annual',
};

const CYCLE_SHORT = {
  weekly: '/wk', monthly: '/mo', quarterly: '/qtr',
  biannual: '/6mo', annual: '/yr',
};

const CATEGORY_COLORS = {
  Entertainment: 'text-wb-purple bg-wb-purple/10',
  Streaming:     'text-wb-blue bg-wb-blue/10',
  Music:         'text-wb-green bg-wb-green/10',
  Productivity:  'text-wb-gold bg-wb-gold/10',
  'Health & Fitness': 'text-wb-green bg-wb-green/10',
  'News & Media': 'text-wb-amber bg-wb-amber/10',
  Gaming:        'text-wb-red bg-wb-red/10',
  Shopping:      'text-wb-gold bg-wb-gold/10',
  'Cloud Storage': 'text-wb-blue bg-wb-blue/10',
  Education:     'text-wb-purple bg-wb-purple/10',
  Software:      'text-wb-blue bg-wb-blue/10',
  Other:         'text-wb-muted bg-wb-border',
};

const EMPTY_FORM = {
  name: '', amount: '', billing_cycle: 'monthly', next_due_date: '',
  category: 'Streaming', notes: '', is_active: true,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function DueBadge({ dateStr }) {
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0)  return <span className="text-xs font-semibold text-wb-red">Overdue</span>;
  if (days === 0) return <span className="text-xs font-semibold text-wb-red">Due today</span>;
  if (days <= 3)  return <span className="text-xs font-semibold text-wb-red">{days}d left</span>;
  if (days <= 7)  return <span className="text-xs font-semibold text-wb-amber">{days}d left</span>;
  return <span className="text-xs text-wb-muted">{days}d left</span>;
}

function CycleBadge({ cycle }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-wb-border text-wb-muted">
      {CYCLE_LABELS[cycle] ?? cycle}
    </span>
  );
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
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Subscription Form Modal ──────────────────────────────────────────────────

function SubModal({ open, onClose, initial, onSave }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);

  // Reset when modal opens
  useState(() => { setForm(initial ?? EMPTY_FORM); });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleOpen = () => setForm(initial ?? EMPTY_FORM);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.amount || !form.next_due_date) return;
    onSave({ ...form, amount: parseFloat(form.amount) });
  };

  const isEdit = !!initial?.id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Subscription' : 'Add Subscription'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="label">Name *</label>
          <input
            required
            type="text"
            placeholder="Netflix, Spotify, etc."
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>

        {/* Amount + Cycle */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount *</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Billing Cycle</label>
            <select value={form.billing_cycle} onChange={e => set('billing_cycle', e.target.value)}>
              {BILLING_CYCLES.map(c => (
                <option key={c} value={c}>{CYCLE_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Next Due Date */}
        <div>
          <label className="label">Next Due Date *</label>
          <input
            required
            type="date"
            value={form.next_due_date}
            onChange={e => set('next_due_date', e.target.value)}
          />
        </div>

        {/* Category */}
        <div>
          <label className="label">Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea
            rows={2}
            placeholder="Optional notes..."
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            className="resize-none"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-wb-white">Active</p>
            <p className="text-xs text-wb-muted">Include in monthly total</p>
          </div>
          <Toggle checked={form.is_active} onChange={v => set('is_active', v)} />
        </div>

        {/* Monthly equivalent hint */}
        {form.amount && form.billing_cycle !== 'monthly' && (
          <div className="rounded-lg bg-wb-blue/10 border border-wb-blue/20 px-3 py-2">
            <p className="text-xs text-wb-blue">
              Monthly equivalent:{' '}
              <span className="font-semibold">
                {formatCurrency(monthlyEquivalent(parseFloat(form.amount) || 0, form.billing_cycle))}/mo
              </span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1">Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Analytics Banner ─────────────────────────────────────────────────────────

function AnalyticsBanner({ subscriptions, subMonthlyTotal }) {
  const active = subscriptions.filter(s => s.is_active).length;
  const total  = subscriptions.length;
  const annual = subMonthlyTotal * 12;
  const burdenPct = Math.min(100, (subMonthlyTotal / 5000) * 100); // visual only

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 mb-5"
      style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0f1a33 50%, #1a1f2e 100%)', border: '1px solid rgba(59,130,246,0.25)' }}>
      {/* Decorative glow */}
      <div className="absolute -top-8 -right-8 w-40 h-40 bg-wb-blue/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-wb-purple/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="label mb-0.5">Subscription Burden</p>
            <p className="text-3xl font-bold text-wb-white tabular-nums">
              {formatCurrency(subMonthlyTotal)}
              <span className="text-sm font-normal text-wb-muted ml-1">/mo</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-wb-blue/15 rounded-full px-3 py-1.5">
            <Zap size={12} className="text-wb-blue" />
            <span className="text-xs font-semibold text-wb-blue">{active} Active</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/20 rounded-xl p-3">
            <p className="text-xs text-wb-muted mb-0.5">Annual Cost</p>
            <p className="text-base font-bold text-wb-white tabular-nums">{formatCurrency(annual)}</p>
          </div>
          <div className="bg-black/20 rounded-xl p-3">
            <p className="text-xs text-wb-muted mb-0.5">Services</p>
            <p className="text-base font-bold text-wb-white">
              {active}
              <span className="text-wb-muted font-normal text-sm"> / {total} total</span>
            </p>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-3">
            <ProgressBar pct={burdenPct} color="blue" size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upcoming Scroll Strip ────────────────────────────────────────────────────

function UpcomingStrip({ subscriptions }) {
  const upcoming = upcomingSubscriptions(subscriptions, 7);
  if (!upcoming.length) return null;

  return (
    <div className="mb-5">
      <p className="label mb-2">Due This Week</p>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}>
        {upcoming.map(s => {
          const days = s._daysUntil;
          const urgentColor = days <= 3 ? 'border-wb-red/40 bg-wb-red/5' : 'border-wb-amber/40 bg-wb-amber/5';
          return (
            <div
              key={s.id}
              className={`shrink-0 rounded-xl border px-3 py-2.5 min-w-[130px] ${urgentColor}`}
            >
              <p className="text-xs font-semibold text-wb-white truncate mb-1">{s.name}</p>
              <p className="text-sm font-bold text-wb-white tabular-nums">
                {formatCurrency(s.amount)}
                <span className="text-[10px] font-normal text-wb-muted ml-0.5">
                  {CYCLE_SHORT[s.billing_cycle]}
                </span>
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <CycleBadge cycle={s.billing_cycle} />
                <DueBadge dateStr={s.next_due_date} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Subscription Card ────────────────────────────────────────────────────────

function SubCard({ sub, onEdit, onDelete, onToggleActive }) {
  const days = daysUntil(sub.next_due_date);
  const isMonthly = sub.billing_cycle === 'monthly';
  const moEquiv = monthlyEquivalent(sub.amount, sub.billing_cycle);
  const catColor = CATEGORY_COLORS[sub.category] ?? CATEGORY_COLORS.Other;

  return (
    <div className={`card mb-3 transition-opacity ${sub.is_active ? '' : 'opacity-50'}`}>
      <div className="flex items-start gap-3">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-wb-white text-sm truncate">{sub.name}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${catColor}`}>
              {sub.category}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="text-base font-bold text-wb-white tabular-nums">
              {formatCurrency(sub.amount)}
            </span>
            <span className="text-xs text-wb-muted">{CYCLE_SHORT[sub.billing_cycle]}</span>
            {!isMonthly && (
              <span className="text-xs text-wb-muted">
                · {formatCurrency(moEquiv)}/mo
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-wb-muted">
            <Calendar size={11} />
            <span>{formatDateShort(sub.next_due_date)}</span>
            <span>·</span>
            <DueBadge dateStr={sub.next_due_date} />
          </div>

          {sub.notes && (
            <p className="text-xs text-wb-muted mt-1.5 line-clamp-1">{sub.notes}</p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Toggle checked={sub.is_active} onChange={() => onToggleActive(sub)} />
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(sub)}
              className="p-1.5 rounded-lg text-wb-muted hover:text-wb-blue hover:bg-wb-blue/10 transition-colors"
              aria-label="Edit subscription"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(sub.id)}
              className="p-1.5 rounded-lg text-wb-muted hover:text-wb-red hover:bg-wb-red/10 transition-colors"
              aria-label="Delete subscription"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-wb-blue/10 flex items-center justify-center mb-4">
        <RefreshCw size={28} className="text-wb-blue" />
      </div>
      <p className="text-lg font-semibold text-wb-white mb-1">No subscriptions yet</p>
      <p className="text-sm text-wb-muted mb-6 max-w-xs">
        Track your recurring services and see your total monthly spend at a glance.
      </p>
      <button className="btn-primary" onClick={onAdd}>
        <Plus size={16} /> Add Subscription
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Subscriptions() {
  const {
    subscriptions, addSubscription, updateSubscription, deleteSubscription, subMonthlyTotal,
  } = useFinance();

  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  // Sort: active first, then soonest due
  const sorted = useMemo(() => {
    return [...subscriptions].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return daysUntil(a.next_due_date) - daysUntil(b.next_due_date);
    });
  }, [subscriptions]);

  const active   = sorted.filter(s => s.is_active);
  const inactive = sorted.filter(s => !s.is_active);

  const openAdd  = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (sub) => { setEditTarget(sub); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = (data) => {
    if (editTarget) {
      updateSubscription(editTarget.id, data);
    } else {
      addSubscription(data);
    }
    closeModal();
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this subscription?')) deleteSubscription(id);
  };

  const handleToggle = (sub) => {
    updateSubscription(sub.id, { is_active: !sub.is_active });
  };

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="page-header mb-0">Subscriptions</h1>
          <button className="btn-primary text-sm py-2 px-4" onClick={openAdd}>
            <Plus size={15} /> Add
          </button>
        </div>

        {subscriptions.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <>
            {/* Analytics Banner */}
            <AnalyticsBanner subscriptions={subscriptions} subMonthlyTotal={subMonthlyTotal} />

            {/* Upcoming this week */}
            <UpcomingStrip subscriptions={subscriptions} />

            {/* Active list */}
            {active.length > 0 && (
              <div className="mb-4">
                <p className="label mb-3">
                  Active
                  <span className="ml-1.5 normal-case text-wb-muted/60">{active.length}</span>
                </p>
                {active.map(s => (
                  <SubCard
                    key={s.id}
                    sub={s}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggle}
                  />
                ))}
              </div>
            )}

            {/* Inactive list */}
            {inactive.length > 0 && (
              <div>
                <p className="label mb-3">
                  Inactive
                  <span className="ml-1.5 normal-case text-wb-muted/60">{inactive.length}</span>
                </p>
                {inactive.map(s => (
                  <SubCard
                    key={s.id}
                    sub={s}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggle}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      <SubModal
        open={modalOpen}
        onClose={closeModal}
        initial={editTarget ? { ...editTarget, amount: String(editTarget.amount) } : null}
        onSave={handleSave}
      />
    </Layout>
  );
}
