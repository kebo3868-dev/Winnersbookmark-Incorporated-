import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, Repeat, TrendingUp,
  CalendarDays, DollarSign, AlertTriangle, Tag,
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency, formatDate, formatDateShort, today,
  monthKey, monthlyIncome, formatMonth,
} from '../lib/finance';

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Side Hustle',
  'Investment', 'Rental', 'Gift', 'Other',
];

const FREQUENCIES = [
  { value: 'weekly',      label: 'Weekly'       },
  { value: 'biweekly',    label: 'Bi-Weekly'    },
  { value: 'semimonthly', label: 'Semi-Monthly' },
  { value: 'monthly',     label: 'Monthly'      },
  { value: 'quarterly',   label: 'Quarterly'    },
  { value: 'annual',      label: 'Annually'     },
];

const CAT_META = {
  Salary:        { badgeCls: 'text-wb-green-light bg-wb-green-muted border-wb-green/20' },
  Freelance:     { badgeCls: 'text-wb-blue-light  bg-wb-blue-muted  border-wb-blue/20'  },
  Business:      { badgeCls: 'text-wb-purple       bg-purple-900/30  border-purple-500/20' },
  'Side Hustle': { badgeCls: 'text-wb-gold         bg-wb-amber-muted border-wb-amber/20' },
  Investment:    { badgeCls: 'text-wb-blue-light   bg-wb-blue-muted  border-wb-blue/20'  },
  Rental:        { badgeCls: 'text-wb-amber        bg-wb-amber-muted border-wb-amber/20' },
  Gift:          { badgeCls: 'text-wb-red-light    bg-wb-red-muted   border-wb-red/20'   },
  Other:         { badgeCls: 'text-wb-muted        bg-wb-dark        border-wb-border'   },
};

const EMPTY_FORM = {
  source_name:        '',
  amount:             '',
  received_date:      today(),
  category:           'Salary',
  is_recurring:       false,
  frequency:          'monthly',
  next_expected_date: '',
  notes:              '',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Income() {
  const navigate = useNavigate();
  const {
    income, addIncome, updateIncome, deleteIncome,
    thisMonthIncome, month,
  } = useFinance();

  const [modalOpen, setModalOpen]         = useState(false);
  const [editTarget, setEditTarget]       = useState(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [errors, setErrors]               = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // ─── Derived summaries ────────────────────────────────────────────────────

  const currentYear = new Date().getFullYear();

  const thisYearTotal = useMemo(
    () => income
      .filter(i => new Date((i.received_date || '').slice(0, 10) + 'T00:00:00').getFullYear() === currentYear)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [income, currentYear],
  );

  const lastMonthKey = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }, []);

  const lastMonthTotal = useMemo(
    () => monthlyIncome(income, lastMonthKey),
    [income, lastMonthKey],
  );

  // ─── Group by month, most recent first ───────────────────────────────────

  const grouped = useMemo(() => {
    const sorted = [...income].sort((a, b) =>
      (b.received_date || '').localeCompare(a.received_date || ''),
    );
    const map = new Map();
    for (const item of sorted) {
      const key = monthKey(item.received_date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return Array.from(map.entries());
  }, [income]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditTarget(item);
    setForm({
      source_name:        item.source_name        || '',
      amount:             item.amount != null ? String(item.amount) : '',
      received_date:      item.received_date       || today(),
      category:           item.category            || 'Salary',
      is_recurring:       !!item.is_recurring,
      frequency:          item.frequency           || 'monthly',
      next_expected_date: item.next_expected_date  || '',
      notes:              item.notes               || '',
    });
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function field(key) {
    return (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  function toggleRecurring() {
    setForm(prev => ({ ...prev, is_recurring: !prev.is_recurring }));
  }

  function validate() {
    const e = {};
    if (!form.source_name.trim()) e.source_name = 'Source name is required.';
    if (!form.amount || isNaN(parseFloat(form.amount))) e.amount = 'A valid amount is required.';
    if (!form.received_date) e.received_date = 'Date is required.';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      source_name:        form.source_name.trim(),
      amount:             parseFloat(form.amount) || 0,
      received_date:      form.received_date,
      category:           form.category,
      is_recurring:       form.is_recurring,
      frequency:          form.is_recurring ? form.frequency : null,
      next_expected_date: form.is_recurring && form.next_expected_date
        ? form.next_expected_date : null,
      notes:              form.notes.trim() || null,
    };

    if (editTarget) updateIncome(editTarget.id, payload);
    else            addIncome(payload);
    closeModal();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="page-container space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-wb-card border border-wb-border text-wb-muted hover:text-wb-white transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-2xl font-bold tracking-tight">Income</h1>
          </div>
          <button onClick={openAdd} className="btn-primary px-4 py-2 text-sm">
            <Plus size={16} />
            Add Income
          </button>
        </div>

        {/* Summary Cards */}
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          {/* This Month */}
          <div className="card shrink-0 min-w-[148px] flex-1 space-y-1.5 border-wb-green/20">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-wb-green" />
              <p className="label mb-0">This Month</p>
            </div>
            <p className="text-xl font-bold text-wb-green-light tabular-nums">
              {formatCurrency(thisMonthIncome, 'USD', true)}
            </p>
          </div>

          {/* This Year */}
          <div className="card shrink-0 min-w-[132px] flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={13} className="text-wb-blue-light" />
              <p className="label mb-0">This Year</p>
            </div>
            <p className="text-xl font-bold text-wb-white tabular-nums">
              {formatCurrency(thisYearTotal, 'USD', true)}
            </p>
          </div>

          {/* Last Month */}
          <div className="card shrink-0 min-w-[132px] flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <DollarSign size={13} className="text-wb-muted" />
              <p className="label mb-0">Last Month</p>
            </div>
            <p className="text-xl font-bold text-wb-muted tabular-nums">
              {formatCurrency(lastMonthTotal, 'USD', true)}
            </p>
          </div>
        </div>

        {/* Income List */}
        {grouped.length === 0 ? (
          <IncomeEmptyState onAdd={openAdd} />
        ) : (
          <div className="space-y-6">
            {grouped.map(([mk, items]) => {
              const monthTotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
              return (
                <div key={mk} className="space-y-2">
                  {/* Month header */}
                  <div className="flex items-center justify-between px-1 pb-0.5 border-b border-wb-border/40">
                    <p className="text-sm font-semibold text-wb-muted uppercase tracking-wider">
                      {formatMonth(mk)}
                    </p>
                    <span className="text-sm font-bold text-wb-green-light tabular-nums">
                      +{formatCurrency(monthTotal)}
                    </span>
                  </div>

                  {/* Items */}
                  {items.map(item => {
                    const badgeCls = (CAT_META[item.category] || CAT_META.Other).badgeCls;
                    return (
                      <div key={item.id} className="card flex items-center gap-3 slide-up relative">
                        {/* Icon */}
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-wb-green-muted border border-wb-green/20 flex items-center justify-center">
                          <TrendingUp size={16} className="text-wb-green-light" />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-wb-white text-sm truncate leading-snug">
                              {item.source_name}
                            </p>
                            {item.is_recurring && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-wb-blue-light bg-wb-blue-muted border border-wb-blue/20 px-1.5 py-0.5 rounded-full shrink-0">
                                <Repeat size={9} />
                                Recurring
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badgeCls}`}>
                              <Tag size={9} />
                              {item.category}
                            </span>
                            <span className="text-xs text-wb-muted">
                              {formatDateShort(item.received_date)}
                            </span>
                          </div>
                        </div>

                        {/* Amount */}
                        <span className="text-base font-bold text-wb-green-light tabular-nums shrink-0">
                          +{formatCurrency(Number(item.amount) || 0)}
                        </span>

                        {/* Action buttons */}
                        {deleteConfirmId !== item.id && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1.5 rounded-lg text-wb-muted hover:text-wb-blue-light hover:bg-wb-blue-muted transition-colors"
                              aria-label="Edit income"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-1.5 rounded-lg text-wb-muted hover:text-wb-red-light hover:bg-wb-red-muted transition-colors"
                              aria-label="Delete income"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}

                        {/* Inline delete confirm */}
                        {deleteConfirmId === item.id && (
                          <div className="absolute inset-0 bg-wb-card/95 backdrop-blur-sm rounded-xl border border-wb-red/30 flex items-center justify-between gap-3 px-4">
                            <div className="flex items-center gap-2 text-wb-red-light">
                              <AlertTriangle size={14} />
                              <span className="text-sm font-medium">Delete this entry?</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-3 py-1.5 text-xs font-semibold bg-wb-dark border border-wb-border text-wb-muted hover:text-wb-white rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => { deleteIncome(item.id); setDeleteConfirmId(null); }}
                                className="px-3 py-1.5 text-xs font-semibold bg-wb-red hover:bg-red-600 text-white rounded-lg transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Income' : 'Add Income'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Source Name */}
          <div>
            <label className="label">Source Name *</label>
            <input
              type="text"
              value={form.source_name}
              onChange={field('source_name')}
              placeholder="e.g. Employer — Acme Corp"
            />
            {errors.source_name && (
              <p className="text-xs text-wb-red-light mt-1">{errors.source_name}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="label">Amount *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={field('amount')}
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="text-xs text-wb-red-light mt-1">{errors.amount}</p>
            )}
          </div>

          {/* Date Received */}
          <div>
            <label className="label">Date Received *</label>
            <input
              type="date"
              value={form.received_date}
              onChange={field('received_date')}
            />
            {errors.received_date && (
              <p className="text-xs text-wb-red-light mt-1">{errors.received_date}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="label">Category</label>
            <select value={form.category} onChange={field('category')}>
              {INCOME_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center justify-between p-3 bg-wb-dark rounded-xl border border-wb-border">
            <div className="flex items-center gap-2">
              <Repeat size={15} className="text-wb-blue-light" />
              <span className="text-sm font-medium text-wb-white">Recurring Income?</span>
            </div>
            <button
              type="button"
              onClick={toggleRecurring}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                form.is_recurring ? 'bg-wb-blue' : 'bg-wb-border'
              }`}
              role="switch"
              aria-checked={form.is_recurring}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  form.is_recurring ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Recurring sub-fields */}
          {form.is_recurring && (
            <div className="space-y-4 pl-3 border-l-2 border-wb-blue/30">
              <div>
                <label className="label">Frequency</label>
                <select value={form.frequency} onChange={field('frequency')}>
                  {FREQUENCIES.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  Next Expected Date{' '}
                  <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.next_expected_date}
                  onChange={field('next_expected_date')}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">
              Notes{' '}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={field('notes')}
              placeholder="Additional notes…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1 py-2.5">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 py-2.5">
              {editTarget ? 'Save Changes' : 'Save Income'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function IncomeEmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-wb-green-muted border border-wb-green/20 flex items-center justify-center">
        <TrendingUp size={30} className="text-wb-green-light" />
      </div>
      <div className="space-y-1.5">
        <p className="font-bold text-wb-white text-lg">No income recorded</p>
        <p className="text-sm text-wb-muted max-w-xs leading-relaxed">
          Start tracking your income to see monthly summaries, trends, and cash flow projections.
        </p>
      </div>
      <button onClick={onAdd} className="btn-primary px-8">
        <Plus size={16} />
        Add First Income
      </button>
    </div>
  );
}
