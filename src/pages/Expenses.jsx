import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, Tag,
  TrendingDown, Calendar, Search, X, Filter,
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency, formatDateShort, today, monthKey,
  monthlyExpenses, spendingByCategory, formatMonth,
} from '../lib/finance';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Housing', 'Food & Grocery', 'Dining Out', 'Transportation',
  'Shopping', 'Entertainment', 'Health', 'Subscriptions',
  'Utilities', 'Insurance', 'Education', 'Personal Care',
  'Travel', 'Debt Payment', 'Savings Transfer', 'Other',
];

const CAT_COLORS = {
  'Housing':          'bg-wb-blue/10 text-wb-blue-light',
  'Food & Grocery':   'bg-wb-green/10 text-wb-green-light',
  'Dining Out':       'bg-wb-amber/10 text-wb-amber',
  'Transportation':   'bg-wb-purple/10 text-wb-purple',
  'Shopping':         'bg-wb-gold/10 text-wb-gold',
  'Entertainment':    'bg-purple-500/10 text-wb-purple',
  'Health':           'bg-wb-green/10 text-wb-green-light',
  'Subscriptions':    'bg-wb-blue/10 text-wb-blue-light',
  'Utilities':        'bg-wb-amber/10 text-wb-amber',
  'Insurance':        'bg-wb-red/10 text-wb-red-light',
  'Education':        'bg-wb-purple/10 text-wb-purple',
  'Personal Care':    'bg-wb-gold/10 text-wb-gold',
  'Travel':           'bg-wb-blue/10 text-wb-blue-light',
  'Debt Payment':     'bg-wb-red/10 text-wb-red-light',
  'Savings Transfer': 'bg-wb-green/10 text-wb-green-light',
  'Other':            'bg-wb-border text-wb-muted',
};

const EMPTY_FORM = {
  name: '', amount: '', category: 'Food & Grocery',
  transaction_date: today(), is_recurring: false, notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function catColor(cat) {
  return CAT_COLORS[cat] || CAT_COLORS['Other'];
}

// ─── Expense Form ─────────────────────────────────────────────────────────────

function ExpenseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name.trim() && Number(form.amount) > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Description</label>
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Whole Foods, Uber, Amazon…"
          autoFocus
        />
      </div>
      <div>
        <label className="label">Amount</label>
        <input
          type="number" min="0" step="0.01"
          value={form.amount}
          onChange={e => set('amount', e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div>
        <label className="label">Category</label>
        <select value={form.category} onChange={e => set('category', e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Date</label>
        <input type="date" value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => set('is_recurring', !form.is_recurring)}
          className={`w-10 h-6 rounded-full transition-colors ${form.is_recurring ? 'bg-wb-blue' : 'bg-wb-border'}`}
        >
          <span className={`block w-4 h-4 rounded-full bg-white mx-1 transition-transform ${form.is_recurring ? 'translate-x-4' : ''}`} />
        </button>
        <span className="text-sm text-wb-white">Recurring expense</span>
      </div>
      <div>
        <label className="label">Notes (optional)</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any notes…" />
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button onClick={() => valid && onSave(form)} disabled={!valid} className="btn-primary flex-1">
          Save Expense
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Expenses() {
  const navigate = useNavigate();
  const { expenses, addExpense, updateExpense, deleteExpense, month } = useFinance();

  const [modal, setModal]   = useState(null); // null | 'add' | {expense}
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const thisMonthTotal = useMemo(() => monthlyExpenses(expenses, month), [expenses, month]);
  const catBreakdown   = useMemo(() => spendingByCategory(expenses, month), [expenses, month]);

  const filtered = useMemo(() => {
    return expenses
      .filter(e => {
        const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
        const matchCat    = !filterCat || e.category === filterCat;
        return matchSearch && matchCat;
      })
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  }, [expenses, search, filterCat]);

  const topCats = useMemo(() => {
    return Object.entries(catBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [catBreakdown]);

  function handleSave(form) {
    const data = { ...form, amount: Number(form.amount) };
    if (modal === 'add') {
      addExpense(data);
    } else {
      updateExpense(modal.id, data);
    }
    setModal(null);
  }

  return (
    <Layout>
      <div className="page-container space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Expenses</h1>
            <p className="text-xs text-wb-muted">{formatMonth(month)}</p>
          </div>
          <button onClick={() => setModal('add')} className="btn-primary py-2 px-4 text-sm">
            <Plus size={16} /> Add
          </button>
        </div>

        {/* Month Total */}
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg,#3b0a0a 0%,#1a0a0a 100%)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-xs text-wb-red-light/70 uppercase tracking-widest mb-1">Total Spent — {formatMonth(month)}</p>
          <p className="text-3xl font-bold text-wb-white">{formatCurrency(thisMonthTotal)}</p>
          <p className="text-xs text-wb-muted mt-1">{expenses.filter(e => monthKey(e.transaction_date) === month).length} transactions</p>
        </div>

        {/* Category breakdown */}
        {topCats.length > 0 && (
          <div className="card space-y-3">
            <h2 className="section-title flex items-center gap-2">
              <Tag size={15} className="text-wb-amber" />
              By Category
            </h2>
            {topCats.map(([cat, amt]) => {
              const pct = thisMonthTotal > 0 ? (amt / thisMonthTotal) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor(cat)}`}>{cat}</span>
                    <span className="text-sm font-semibold text-wb-white">{formatCurrency(amt)}</span>
                  </div>
                  <div className="h-1 bg-wb-border rounded-full overflow-hidden">
                    <div className="h-full bg-wb-red/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wb-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search expenses…"
              className="pl-8 pr-8"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-wb-muted hover:text-wb-white">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(f => !f)}
            className={`btn-secondary px-3 py-2.5 ${filterCat ? 'border-wb-blue text-wb-blue-light' : ''}`}
          >
            <Filter size={15} />
          </button>
        </div>

        {showFilter && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCat('')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!filterCat ? 'bg-wb-blue/15 border-wb-blue/30 text-wb-blue-light' : 'border-wb-border text-wb-muted'}`}
            >
              All
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setFilterCat(filterCat === c ? '' : c)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterCat === c ? 'bg-wb-blue/15 border-wb-blue/30 text-wb-blue-light' : 'border-wb-border text-wb-muted'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Expense list */}
        {filtered.length === 0 ? (
          <div className="card text-center py-10">
            <TrendingDown size={32} className="text-wb-muted mx-auto mb-3" />
            <p className="text-sm font-semibold text-wb-white mb-1">
              {expenses.length === 0 ? 'No expenses yet' : 'No results'}
            </p>
            <p className="text-xs text-wb-muted mb-4">
              {expenses.length === 0 ? 'Log your first expense to start tracking' : 'Try a different search or filter'}
            </p>
            {expenses.length === 0 && (
              <button onClick={() => setModal('add')} className="btn-primary text-sm py-2.5 px-5">
                <Plus size={15} /> Add Expense
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(exp => (
              <div key={exp.id} className="card-hover flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${catColor(exp.category)}`}>
                  {exp.category.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-wb-white truncate">{exp.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-wb-muted">{formatDateShort(exp.transaction_date)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${catColor(exp.category)}`}>{exp.category}</span>
                    {exp.is_recurring && <span className="text-[10px] text-wb-blue-light bg-wb-blue/10 px-1.5 py-0.5 rounded-full">Recurring</span>}
                  </div>
                </div>
                <p className="text-sm font-bold text-wb-red-light shrink-0">−{formatCurrency(exp.amount)}</p>
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button onClick={() => setModal(exp)} className="p-1.5 rounded-lg text-wb-muted hover:text-wb-white hover:bg-wb-border transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteExpense(exp.id)} className="p-1.5 rounded-lg text-wb-muted hover:text-wb-red-light hover:bg-wb-red/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal
          open={!!modal}
          onClose={() => setModal(null)}
          title={modal === 'add' ? 'Add Expense' : 'Edit Expense'}
        >
          {modal && (
            <ExpenseForm
              initial={modal === 'add' ? EMPTY_FORM : {
                name: modal.name, amount: String(modal.amount),
                category: modal.category, transaction_date: modal.transaction_date,
                is_recurring: modal.is_recurring || false, notes: modal.notes || '',
              }}
              onSave={handleSave}
              onCancel={() => setModal(null)}
            />
          )}
        </Modal>
      </div>
    </Layout>
  );
}
