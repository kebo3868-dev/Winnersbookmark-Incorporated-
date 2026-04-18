import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, CreditCard,
  Wallet, PiggyBank, TrendingUp, Landmark,
  DollarSign, Building2, AlertTriangle,
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import AmountDisplay from '../components/AmountDisplay';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate, totalAssets, totalDebt, today } from '../lib/finance';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: 'checking',   label: 'Checking',    icon: Landmark   },
  { value: 'savings',    label: 'Savings',     icon: PiggyBank  },
  { value: 'credit',     label: 'Credit Card', icon: CreditCard },
  { value: 'cash',       label: 'Cash',        icon: Wallet     },
  { value: 'investment', label: 'Investment',  icon: TrendingUp },
  { value: 'other',      label: 'Other',       icon: DollarSign },
];

const TYPE_META = {
  checking:   { label: 'Checking',    iconCls: 'text-wb-blue-light',  badgeCls: 'text-wb-blue-light  bg-wb-blue-muted  border-wb-blue/20',   balCls: 'text-wb-white'        },
  savings:    { label: 'Savings',     iconCls: 'text-wb-green-light', badgeCls: 'text-wb-green-light bg-wb-green-muted border-wb-green/20',   balCls: 'text-wb-green-light'  },
  credit:     { label: 'Credit Card', iconCls: 'text-wb-red-light',   badgeCls: 'text-wb-red-light   bg-wb-red-muted   border-wb-red/20',     balCls: 'text-wb-red-light'    },
  cash:       { label: 'Cash',        iconCls: 'text-wb-gold',        badgeCls: 'text-wb-gold        bg-wb-amber-muted border-wb-amber/20',   balCls: 'text-wb-gold'         },
  investment: { label: 'Investment',  iconCls: 'text-wb-purple',      badgeCls: 'text-wb-purple      bg-purple-900/30  border-purple-500/20', balCls: 'text-wb-purple'       },
  other:      { label: 'Other',       iconCls: 'text-wb-muted',       badgeCls: 'text-wb-muted       bg-wb-dark        border-wb-border',     balCls: 'text-wb-white'        },
};

const EMPTY_FORM = {
  name: '',
  type: 'checking',
  institution: '',
  current_balance: '',
  available_balance: '',
  notes: '',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts, addAccount, updateAccount, deleteAccount, balance } = useFinance();

  const [modalOpen, setModalOpen]         = useState(false);
  const [editTarget, setEditTarget]       = useState(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [errors, setErrors]               = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const assets = useMemo(() => totalAssets(accounts), [accounts]);
  const debt   = useMemo(() => totalDebt(accounts),   [accounts]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(acct) {
    setEditTarget(acct);
    setForm({
      name:              acct.name              || '',
      type:              acct.type              || 'checking',
      institution:       acct.institution       || '',
      current_balance:   acct.current_balance   != null ? String(acct.current_balance)   : '',
      available_balance: acct.available_balance != null ? String(acct.available_balance) : '',
      notes:             acct.notes             || '',
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

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Account name is required.';
    if (form.current_balance === '' || isNaN(parseFloat(form.current_balance)))
      e.current_balance = 'A valid balance is required.';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      name:              form.name.trim(),
      type:              form.type,
      institution:       form.institution.trim() || null,
      current_balance:   parseFloat(form.current_balance)  || 0,
      available_balance: form.available_balance !== ''
        ? parseFloat(form.available_balance) : null,
      notes:             form.notes.trim() || null,
    };

    if (editTarget) updateAccount(editTarget.id, payload);
    else            addAccount(payload);
    closeModal();
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

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
            <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          </div>
          <button onClick={openAdd} className="btn-primary px-4 py-2 text-sm">
            <Plus size={16} />
            Add
          </button>
        </div>

        {/* Summary Strip */}
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          {/* Net Balance */}
          <div className="card shrink-0 min-w-[148px] flex-1 space-y-1.5">
            <p className="label mb-0">Net Balance</p>
            <p className={`text-xl font-bold tabular-nums ${balance >= 0 ? 'text-wb-white' : 'text-wb-red-light'}`}>
              {formatCurrency(balance, 'USD', true)}
            </p>
            <p className="text-xs text-wb-muted">All accounts</p>
          </div>

          {/* Assets */}
          <div className="card shrink-0 min-w-[132px] flex-1 space-y-1.5">
            <p className="label mb-0">Assets</p>
            <p className="text-xl font-bold text-wb-green-light tabular-nums">
              {formatCurrency(assets, 'USD', true)}
            </p>
            <p className="text-xs text-wb-muted">Non-credit</p>
          </div>

          {/* Debt */}
          <div className="card shrink-0 min-w-[132px] flex-1 space-y-1.5">
            <p className="label mb-0">Debt</p>
            <p className="text-xl font-bold text-wb-red-light tabular-nums">
              {formatCurrency(debt, 'USD', true)}
            </p>
            <p className="text-xs text-wb-muted">Credit cards</p>
          </div>
        </div>

        {/* Account list or empty state */}
        {accounts.length === 0 ? (
          <AccountsEmptyState onAdd={openAdd} />
        ) : (
          <div className="space-y-3">
            <p className="section-title">
              Your Accounts
              <span className="text-sm font-normal text-wb-muted ml-2">
                ({accounts.length})
              </span>
            </p>

            {accounts.map(acct => {
              const meta = TYPE_META[acct.type] || TYPE_META.other;
              const TypeIcon = (ACCOUNT_TYPES.find(t => t.value === acct.type) || ACCOUNT_TYPES[5]).icon;
              const bal = Number(acct.current_balance) || 0;
              const avail = acct.available_balance != null ? Number(acct.available_balance) : null;
              const showAvail = avail !== null && avail !== bal;

              return (
                <div key={acct.id} className="card space-y-3 slide-up">

                  {/* Top: icon + name + badge + action buttons */}
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl border ${meta.badgeCls} shrink-0`}>
                      <TypeIcon size={17} className={meta.iconCls} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-wb-white truncate leading-tight">
                          {acct.name}
                        </p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.badgeCls}`}>
                          {meta.label}
                        </span>
                      </div>
                      {acct.institution && (
                        <p className="text-xs text-wb-muted flex items-center gap-1 mt-0.5">
                          <Building2 size={11} />
                          {acct.institution}
                        </p>
                      )}
                    </div>

                    {/* Edit / Delete (hidden while confirm is showing) */}
                    {deleteConfirmId !== acct.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(acct)}
                          className="p-1.5 rounded-lg text-wb-muted hover:text-wb-blue-light hover:bg-wb-blue-muted transition-colors"
                          aria-label="Edit account"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(acct.id)}
                          className="p-1.5 rounded-lg text-wb-muted hover:text-wb-red-light hover:bg-wb-red-muted transition-colors"
                          aria-label="Delete account"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Balance row */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-wb-muted mb-0.5">
                        {acct.type === 'credit' ? 'Amount Owed' : 'Current Balance'}
                      </p>
                      <span className={`text-2xl font-bold tabular-nums ${meta.balCls}`}>
                        {formatCurrency(Math.abs(bal))}
                      </span>
                    </div>
                    {showAvail && (
                      <div className="text-right">
                        <p className="text-xs text-wb-muted mb-0.5">Available</p>
                        <span className="text-sm font-semibold text-wb-white tabular-nums">
                          {formatCurrency(Math.abs(avail))}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <p className="text-xs text-wb-muted/60 border-t border-wb-border/40 pt-2">
                    Last updated {formatDate(acct.updated_at || acct.created_at)}
                  </p>

                  {/* Inline delete confirm */}
                  {deleteConfirmId === acct.id && (
                    <div className="bg-wb-red-muted border border-wb-red/30 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-wb-red-light">
                        <AlertTriangle size={14} />
                        <span className="text-sm font-medium">Delete this account?</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 text-xs font-semibold bg-wb-card border border-wb-border text-wb-muted hover:text-wb-white rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => { deleteAccount(acct.id); setDeleteConfirmId(null); }}
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
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Account' : 'Add Account'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name */}
          <div>
            <label className="label">Account Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={field('name')}
              placeholder="e.g. Chase Checking"
            />
            {errors.name && (
              <p className="text-xs text-wb-red-light mt-1">{errors.name}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="label">Account Type</label>
            <select value={form.type} onChange={field('type')}>
              {ACCOUNT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Institution */}
          <div>
            <label className="label">
              Institution Name{' '}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.institution}
              onChange={field('institution')}
              placeholder="e.g. Chase, Wells Fargo, Fidelity"
            />
          </div>

          {/* Current Balance */}
          <div>
            <label className="label">
              {form.type === 'credit' ? 'Amount Owed *' : 'Current Balance *'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.current_balance}
              onChange={field('current_balance')}
              placeholder="0.00"
            />
            {form.type === 'credit' && (
              <p className="text-xs text-wb-muted mt-1">
                Enter the amount you currently owe (positive number).
              </p>
            )}
            {errors.current_balance && (
              <p className="text-xs text-wb-red-light mt-1">{errors.current_balance}</p>
            )}
          </div>

          {/* Available Balance */}
          <div>
            <label className="label">
              Available Balance{' '}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.available_balance}
              onChange={field('available_balance')}
              placeholder="0.00"
            />
          </div>

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
              placeholder="Any notes about this account…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1 py-2.5">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 py-2.5">
              {editTarget ? 'Save Changes' : 'Save Account'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function AccountsEmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-wb-blue-muted border border-wb-blue/20 flex items-center justify-center">
        <Landmark size={30} className="text-wb-blue-light" />
      </div>
      <div className="space-y-1.5">
        <p className="font-bold text-wb-white text-lg">Add your first account</p>
        <p className="text-sm text-wb-muted max-w-xs leading-relaxed">
          Track checking, savings, credit cards, and cash all in one place for a complete financial picture.
        </p>
      </div>
      <button onClick={onAdd} className="btn-primary px-8">
        <Plus size={16} />
        Add Account
      </button>
    </div>
  );
}
