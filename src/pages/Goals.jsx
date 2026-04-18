import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, Target,
  CheckCircle2, TrendingUp, ChevronDown,
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ProgressBar from '../components/ProgressBar';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate, today, goalProgress } from '../lib/finance';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_TYPES = [
  'Emergency Fund', 'Vacation', 'Down Payment', 'Car Fund',
  'Debt Payoff', 'Holiday Fund', 'Wedding', 'Education',
  'Home Repair', 'Investment', 'Retirement', 'Custom',
];

const GOAL_ICONS = {
  'Emergency Fund': '🛡️', 'Vacation': '✈️', 'Down Payment': '🏠',
  'Car Fund': '🚗', 'Debt Payoff': '💳', 'Holiday Fund': '🎁',
  'Wedding': '💍', 'Education': '📚', 'Home Repair': '🔨',
  'Investment': '📈', 'Retirement': '🌅', 'Custom': '🎯',
};

const EMPTY_FORM = {
  name: '', type: 'Custom', target_amount: '',
  current_amount: '', target_date: '', recurring_contribution: '', notes: '',
};

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, onEdit, onDelete, onContribute }) {
  const { pct, remaining, daysToGoal, onTrack } = goalProgress(goal);
  const completed = pct >= 100;
  const color = completed ? 'green' : pct >= 60 ? 'blue' : pct >= 30 ? 'amber' : 'red';

  return (
    <div className="card space-y-3">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{GOAL_ICONS[goal.type] || '🎯'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-wb-white">{goal.name}</p>
              <p className="text-xs text-wb-muted">{goal.type}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {completed && <CheckCircle2 size={14} className="text-wb-green-light" />}
              <button onClick={() => onEdit(goal)} className="p-1.5 rounded-lg text-wb-muted hover:text-wb-white hover:bg-wb-border transition-colors">
                <Pencil size={13} />
              </button>
              <button onClick={() => onDelete(goal.id)} className="p-1.5 rounded-lg text-wb-muted hover:text-wb-red-light hover:bg-wb-red/10 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-wb-white font-semibold">{formatCurrency(goal.current_amount)}</span>
          <span className="text-wb-muted">of {formatCurrency(goal.target_amount)}</span>
        </div>
        <ProgressBar pct={pct} color={color} size="lg" />
      </div>

      <div className="flex items-center gap-4">
        <div>
          <p className="text-[10px] text-wb-muted">Remaining</p>
          <p className="text-xs font-semibold text-wb-white">{formatCurrency(remaining)}</p>
        </div>
        <div className="w-px h-6 bg-wb-border" />
        <div>
          <p className="text-[10px] text-wb-muted">Progress</p>
          <p className={`text-xs font-semibold ${completed ? 'text-wb-green-light' : 'text-wb-white'}`}>
            {Math.round(pct)}%
          </p>
        </div>
        {goal.target_date && (
          <>
            <div className="w-px h-6 bg-wb-border" />
            <div>
              <p className="text-[10px] text-wb-muted">Target Date</p>
              <p className="text-xs font-semibold text-wb-white">{formatDate(goal.target_date)}</p>
            </div>
          </>
        )}
        {daysToGoal !== null && !completed && (
          <>
            <div className="w-px h-6 bg-wb-border" />
            <div>
              <p className="text-[10px] text-wb-muted">Est. Done</p>
              <p className={`text-xs font-semibold ${onTrack === false ? 'text-wb-red-light' : onTrack === true ? 'text-wb-green-light' : 'text-wb-white'}`}>
                ~{daysToGoal}d
              </p>
            </div>
          </>
        )}
      </div>

      {goal.recurring_contribution > 0 && (
        <p className="text-xs text-wb-muted">
          +{formatCurrency(goal.recurring_contribution)}/mo contribution
        </p>
      )}

      {!completed && (
        <button
          onClick={() => onContribute(goal)}
          className="w-full btn-secondary text-sm py-2"
        >
          <TrendingUp size={14} /> Add Contribution
        </button>
      )}
      {completed && (
        <div className="flex items-center justify-center gap-2 text-wb-green-light bg-wb-green/10 rounded-xl py-2.5 text-sm font-semibold">
          <CheckCircle2 size={16} /> Goal Reached!
        </div>
      )}
    </div>
  );
}

// ─── Goal Form ────────────────────────────────────────────────────────────────

function GoalForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name.trim() && Number(form.target_amount) > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Goal Name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Emergency Fund, Hawaii Trip…" autoFocus />
      </div>
      <div>
        <label className="label">Type</label>
        <select value={form.type} onChange={e => set('type', e.target.value)}>
          {GOAL_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Target Amount</label>
          <input type="number" min="0" step="1" value={form.target_amount} onChange={e => set('target_amount', e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="label">Current Amount</label>
          <input type="number" min="0" step="1" value={form.current_amount} onChange={e => set('current_amount', e.target.value)} placeholder="0" />
        </div>
      </div>
      <div>
        <label className="label">Target Date (optional)</label>
        <input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} />
      </div>
      <div>
        <label className="label">Monthly Contribution (optional)</label>
        <input type="number" min="0" step="1" value={form.recurring_contribution} onChange={e => set('recurring_contribution', e.target.value)} placeholder="0" />
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button onClick={() => valid && onSave(form)} disabled={!valid} className="btn-primary flex-1">
          Save Goal
        </button>
      </div>
    </div>
  );
}

// ─── Contribute Modal ─────────────────────────────────────────────────────────

function ContributeForm({ goal, onSave, onCancel }) {
  const [amount, setAmount] = useState('');
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  const valid = Number(amount) > 0;

  return (
    <div className="space-y-4">
      <div className="card bg-wb-green/5 border-wb-green/20">
        <p className="text-xs text-wb-muted mb-1">{goal.name}</p>
        <p className="text-sm font-semibold text-wb-white">
          {formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}
        </p>
        <p className="text-xs text-wb-muted mt-0.5">{formatCurrency(remaining)} remaining</p>
      </div>
      <div>
        <label className="label">Contribution Amount</label>
        <input type="number" min="0" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[50, 100, 250].map(v => (
          <button key={v} onClick={() => setAmount(String(Math.min(v, remaining)))}
            className="btn-secondary text-sm py-2">
            ${v}
          </button>
        ))}
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button onClick={() => valid && onSave(Number(amount))} disabled={!valid} className="btn-primary flex-1">
          <TrendingUp size={14} /> Add
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Goals() {
  const navigate = useNavigate();
  const { goals, addGoal, updateGoal, deleteGoal } = useFinance();

  const [modal, setModal] = useState(null);       // null | 'add' | {goal} | {contribute, goal}
  const [showCompleted, setShowCompleted] = useState(false);

  const active    = useMemo(() => goals.filter(g => (goalProgress(g).pct < 100)), [goals]);
  const completed = useMemo(() => goals.filter(g => (goalProgress(g).pct >= 100)), [goals]);

  const totalSaved  = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);

  function handleSaveGoal(form) {
    const data = {
      ...form,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount) || 0,
      recurring_contribution: Number(form.recurring_contribution) || 0,
    };
    if (modal === 'add') {
      addGoal(data);
    } else if (modal?.id) {
      updateGoal(modal.id, data);
    }
    setModal(null);
  }

  function handleContribute(goalId, amount) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const newAmount = Math.min(Number(goal.current_amount) + amount, Number(goal.target_amount));
    updateGoal(goalId, { current_amount: newAmount });
    setModal(null);
  }

  return (
    <Layout>
      <div className="page-container space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Savings Goals</h1>
            <p className="text-xs text-wb-muted">{goals.length} goal{goals.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setModal('add')} className="btn-primary py-2 px-4 text-sm">
            <Plus size={16} /> New
          </button>
        </div>

        {/* Summary */}
        {goals.length > 0 && (
          <div className="rounded-2xl p-5"
            style={{ background: 'linear-gradient(135deg,#064e3b 0%,#0a0a0f 100%)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <p className="text-[10px] text-wb-green-light/70 uppercase tracking-widest mb-1">Total Saved</p>
            <p className="text-3xl font-bold text-wb-white">{formatCurrency(totalSaved)}</p>
            <p className="text-xs text-wb-muted mt-1">
              of {formatCurrency(totalTarget)} across {goals.length} goal{goals.length !== 1 ? 's' : ''}
            </p>
            {totalTarget > 0 && (
              <div className="mt-3">
                <ProgressBar pct={(totalSaved / totalTarget) * 100} color="green" size="md" />
                <p className="text-xs text-wb-green-light mt-1">{Math.round((totalSaved / totalTarget) * 100)}% of total target</p>
              </div>
            )}
          </div>
        )}

        {/* Active goals */}
        {active.length === 0 && goals.length === 0 ? (
          <div className="card text-center py-10">
            <Target size={32} className="text-wb-muted mx-auto mb-3" />
            <p className="text-sm font-semibold text-wb-white mb-1">No savings goals yet</p>
            <p className="text-xs text-wb-muted mb-4">Set a goal and track your progress toward it</p>
            <button onClick={() => setModal('add')} className="btn-primary text-sm py-2.5 px-5">
              <Plus size={15} /> Create First Goal
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {active.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={g => setModal({ ...g, target_amount: String(g.target_amount), current_amount: String(g.current_amount), recurring_contribution: String(g.recurring_contribution || '') })}
                onDelete={deleteGoal}
                onContribute={g => setModal({ contribute: true, goal: g })}
              />
            ))}
          </div>
        )}

        {/* Completed goals */}
        {completed.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="w-full flex items-center justify-between text-sm text-wb-muted py-2"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-wb-green-light" />
                Completed Goals ({completed.length})
              </span>
              {showCompleted ? <ChevronDown size={14} /> : <TrendingUp size={14} />}
            </button>
            {showCompleted && (
              <div className="space-y-4 mt-2">
                {completed.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={g => setModal({ ...g, target_amount: String(g.target_amount), current_amount: String(g.current_amount), recurring_contribution: String(g.recurring_contribution || '') })}
                    onDelete={deleteGoal}
                    onContribute={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal
          open={modal === 'add' || (!!modal && !modal?.contribute)}
          onClose={() => setModal(null)}
          title={modal === 'add' ? 'New Savings Goal' : 'Edit Goal'}
        >
          {modal && !modal?.contribute && (
            <GoalForm
              initial={modal === 'add' ? EMPTY_FORM : modal}
              onSave={handleSaveGoal}
              onCancel={() => setModal(null)}
            />
          )}
        </Modal>

        {/* Contribute Modal */}
        <Modal
          open={!!modal?.contribute}
          onClose={() => setModal(null)}
          title="Add Contribution"
        >
          {modal?.contribute && (
            <ContributeForm
              goal={modal.goal}
              onSave={amount => handleContribute(modal.goal.id, amount)}
              onCancel={() => setModal(null)}
            />
          )}
        </Modal>
      </div>
    </Layout>
  );
}
