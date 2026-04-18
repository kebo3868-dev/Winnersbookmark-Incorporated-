import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, BarChart3,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Wallet,
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ProgressBar from '../components/ProgressBar';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency, formatMonth, thisMonth, uuid,
  budgetProgress, totalBudgetStats,
} from '../lib/finance';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATS = [
  'Housing', 'Food & Grocery', 'Dining Out', 'Transportation',
  'Shopping', 'Entertainment', 'Health', 'Subscriptions',
  'Utilities', 'Insurance', 'Education', 'Personal Care',
  'Travel', 'Debt Payment', 'Savings Transfer', 'Other',
];

const CAT_ICONS = {
  'Housing': '🏠', 'Food & Grocery': '🛒', 'Dining Out': '🍽️',
  'Transportation': '🚗', 'Shopping': '🛍️', 'Entertainment': '🎬',
  'Health': '💊', 'Subscriptions': '📱', 'Utilities': '⚡',
  'Insurance': '🛡️', 'Education': '📚', 'Personal Care': '✂️',
  'Travel': '✈️', 'Debt Payment': '💳', 'Savings Transfer': '🏦', 'Other': '📦',
};

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, onEdit, onDelete }) {
  const color = cat.overspent ? 'red' : cat.pct >= 80 ? 'amber' : 'green';
  return (
    <div className="py-3 border-b border-wb-border/40 last:border-0">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-base">{CAT_ICONS[cat.category_name] || '📦'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-sm font-medium text-wb-white truncate">{cat.category_name}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => onEdit(cat)} className="p-1 rounded text-wb-muted hover:text-wb-white hover:bg-wb-border transition-colors">
                <Pencil size={12} />
              </button>
              <button onClick={() => onDelete(cat.id)} className="p-1 rounded text-wb-muted hover:text-wb-red-light hover:bg-wb-red/10 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <ProgressBar pct={cat.pct} color={color} size="sm" />
        </div>
      </div>
      <div className="flex items-center justify-between ml-9">
        <div className="flex gap-4">
          <div>
            <p className="text-[10px] text-wb-muted">Spent</p>
            <p className="text-xs font-semibold text-wb-white">{formatCurrency(cat.spent)}</p>
          </div>
          <div>
            <p className="text-[10px] text-wb-muted">Budget</p>
            <p className="text-xs font-semibold text-wb-white">{formatCurrency(cat.allocated_amount)}</p>
          </div>
          <div>
            <p className="text-[10px] text-wb-muted">{cat.overspent ? 'Over' : 'Left'}</p>
            <p className={`text-xs font-semibold ${cat.overspent ? 'text-wb-red-light' : 'text-wb-green-light'}`}>
              {cat.overspent
                ? formatCurrency(cat.spent - cat.allocated_amount)
                : formatCurrency(cat.remaining)}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
          cat.overspent ? 'bg-wb-red/10 text-wb-red-light' :
          cat.pct >= 80  ? 'bg-wb-amber/10 text-wb-amber' :
                           'bg-wb-green/10 text-wb-green-light'
        }`}>
          {cat.overspent ? <AlertTriangle size={10} /> : cat.pct >= 80 ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
          {Math.round(cat.pct)}%
        </div>
      </div>
    </div>
  );
}

// ─── Category Form (modal) ────────────────────────────────────────────────────

function CategoryForm({ initial, usedCats, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.category_name && Number(form.allocated_amount) > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Category</label>
        <select value={form.category_name} onChange={e => set('category_name', e.target.value)}>
          <option value="">Select category…</option>
          {EXPENSE_CATS
            .filter(c => c === form.category_name || !usedCats.includes(c))
            .map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Monthly Budget</label>
        <input
          type="number" min="0" step="1"
          value={form.allocated_amount}
          onChange={e => set('allocated_amount', e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button onClick={() => valid && onSave(form)} disabled={!valid} className="btn-primary flex-1">
          Save Category
        </button>
      </div>
    </div>
  );
}

// ─── Budget Settings Modal ────────────────────────────────────────────────────

function BudgetSettingsForm({ budget, onSave, onCancel }) {
  const [total, setTotal] = useState(String(budget?.total_budget || ''));
  const [income, setIncome] = useState(String(budget?.planned_income || ''));
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Total Monthly Budget</label>
        <input type="number" min="0" step="1" value={total} onChange={e => setTotal(e.target.value)} placeholder="0" />
      </div>
      <div>
        <label className="label">Planned Monthly Income (optional)</label>
        <input type="number" min="0" step="1" value={income} onChange={e => setIncome(e.target.value)} placeholder="0" />
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button
          onClick={() => onSave({ total_budget: Number(total), planned_income: Number(income) })}
          className="btn-primary flex-1"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Main Budget Page ─────────────────────────────────────────────────────────

export default function Budget() {
  const navigate = useNavigate();
  const { budgets, getOrCreateBudget, updateBudget, expenses, month } = useFinance();

  const [catModal, setCatModal]         = useState(null); // null | 'add' | {cat}
  const [settingsModal, setSettingsModal] = useState(false);

  const budget = useMemo(() => budgets.find(b => b.month === month) || {
    id: null, month, total_budget: 0, planned_income: 0, categories: [],
  }, [budgets, month]);

  const cats = budget.categories || [];
  const progress = useMemo(() => budgetProgress(cats, expenses, month), [cats, expenses, month]);
  const stats    = useMemo(() => totalBudgetStats(cats, expenses, month), [cats, expenses, month]);
  const usedCats = cats.map(c => c.category_name);

  function ensureBudget() {
    if (!budget.id) return getOrCreateBudget(month);
    return budget;
  }

  function handleSaveSettings(data) {
    const b = ensureBudget();
    updateBudget(b.id, data);
    setSettingsModal(false);
  }

  function handleSaveCat(form) {
    const b = ensureBudget();
    const newCat = {
      id: form.id || uuid(),
      category_name: form.category_name,
      allocated_amount: Number(form.allocated_amount),
    };
    const updatedCats = form.id
      ? (b.categories || []).map(c => c.id === form.id ? newCat : c)
      : [...(b.categories || []), newCat];
    updateBudget(b.id, { categories: updatedCats });
    setCatModal(null);
  }

  function handleDeleteCat(id) {
    const b = ensureBudget();
    updateBudget(b.id, { categories: (b.categories || []).filter(c => c.id !== id) });
  }

  return (
    <Layout>
      <div className="page-container space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Budget</h1>
            <p className="text-xs text-wb-muted">{formatMonth(month)}</p>
          </div>
          <button onClick={() => setSettingsModal(true)} className="btn-secondary py-2 px-3 text-sm">
            <Pencil size={14} /> Edit
          </button>
        </div>

        {/* Hero */}
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg,#1a1204 0%,#0a0a0f 100%)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <p className="text-[10px] text-wb-gold/70 uppercase tracking-widest mb-1">Monthly Budget</p>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-3xl font-bold text-wb-white">{formatCurrency(budget.total_budget || stats.allocated)}</p>
              {budget.planned_income > 0 && (
                <p className="text-xs text-wb-muted mt-1">Planned income: {formatCurrency(budget.planned_income)}</p>
              )}
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${stats.overBudget ? 'text-wb-red-light' : 'text-wb-green-light'}`}>
                {stats.overBudget ? `−${formatCurrency(stats.spent - stats.allocated)}` : formatCurrency(stats.remaining)}
              </p>
              <p className="text-xs text-wb-muted">{stats.overBudget ? 'over budget' : 'remaining'}</p>
            </div>
          </div>
          <ProgressBar pct={stats.pct} color={stats.overBudget ? 'red' : stats.pct > 80 ? 'amber' : 'green'} size="lg" />
          <div className="flex justify-between mt-2">
            <p className="text-xs text-wb-muted">Spent: {formatCurrency(stats.spent)}</p>
            <p className={`text-xs font-medium ${stats.overBudget ? 'text-wb-red-light' : 'text-wb-gold'}`}>
              {Math.round(stats.pct)}% used
            </p>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="section-title flex items-center gap-2">
              <BarChart3 size={15} className="text-wb-gold" />Categories
            </h2>
            <button
              onClick={() => setCatModal('add')}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus size={13} /> Add
            </button>
          </div>

          {progress.length === 0 ? (
            <div className="text-center py-8">
              <Wallet size={28} className="text-wb-muted mx-auto mb-2" />
              <p className="text-sm text-wb-muted mb-3">No budget categories yet</p>
              <button onClick={() => setCatModal('add')} className="btn-primary text-sm py-2 px-4">
                <Plus size={14} /> Add Category
              </button>
            </div>
          ) : (
            progress
              .sort((a, b) => b.pct - a.pct)
              .map(cat => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  onEdit={c => setCatModal({ ...c, allocated_amount: String(c.allocated_amount) })}
                  onDelete={handleDeleteCat}
                />
              ))
          )}
        </div>

        {/* Overspend summary */}
        {progress.some(c => c.overspent) && (
          <div className="rounded-xl bg-wb-red/5 border border-wb-red/20 p-4 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-wb-red-light" />
              <p className="text-sm font-semibold text-wb-red-light">Over Budget</p>
            </div>
            {progress.filter(c => c.overspent).map(c => (
              <div key={c.id} className="flex justify-between text-xs">
                <span className="text-wb-white">{c.category_name}</span>
                <span className="text-wb-red-light font-semibold">+{formatCurrency(c.spent - c.allocated_amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Modals */}
        <Modal open={settingsModal} onClose={() => setSettingsModal(false)} title="Budget Settings">
          <BudgetSettingsForm budget={budget} onSave={handleSaveSettings} onCancel={() => setSettingsModal(false)} />
        </Modal>

        <Modal
          open={!!catModal}
          onClose={() => setCatModal(null)}
          title={catModal === 'add' ? 'Add Category' : 'Edit Category'}
        >
          {catModal && (
            <CategoryForm
              initial={catModal === 'add'
                ? { category_name: '', allocated_amount: '' }
                : catModal}
              usedCats={usedCats}
              onSave={handleSaveCat}
              onCancel={() => setCatModal(null)}
            />
          )}
        </Modal>
      </div>
    </Layout>
  );
}
