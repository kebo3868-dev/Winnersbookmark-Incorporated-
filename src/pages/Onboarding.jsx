import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, ChevronRight, CheckCircle2, Wallet, CreditCard,
  Banknote, PiggyBank, LayoutDashboard, ArrowRight, RotateCcw,
  Receipt, Repeat, Plus, Calendar,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { today } from '../lib/finance';

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_DOTS = 5;

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking',    icon: Wallet },
  { value: 'savings',  label: 'Savings',     icon: PiggyBank },
  { value: 'credit',   label: 'Credit Card', icon: CreditCard },
  { value: 'cash',     label: 'Cash',        icon: Banknote },
  { value: 'other',    label: 'Other',       icon: LayoutDashboard },
];

const FREQUENCIES = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Bi-weekly' },
  { value: 'monthly',   label: 'Monthly' },
];

const BILLING_CYCLES = [
  { value: 'monthly',   label: 'Monthly' },
  { value: 'annual',    label: 'Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'weekly',    label: 'Weekly' },
];

// ─── Progress Dots ────────────────────────────────────────────────────────────
function ProgressDots({ active }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: TOTAL_DOTS }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < active
              ? 'w-2 h-2 bg-wb-blue'
              : i === active
              ? 'w-6 h-2 bg-wb-blue'
              : 'w-2 h-2 bg-wb-border'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────
function StepWelcome({ onNext, onDemo }) {
  return (
    <div className="flex flex-col items-center text-center px-2 py-6 fade-in">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-wb-blue to-wb-blue-light flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.4)]">
          <TrendingUp size={36} className="text-white" strokeWidth={2.5} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-wb-gold rounded-full flex items-center justify-center">
          <span className="text-wb-black text-xs font-black">W</span>
        </div>
      </div>

      <h1 className="text-3xl font-black tracking-tight mb-2 text-wb-white">
        Winnersbookmark
        <br />
        <span className="text-gradient-blue">Financial</span>
      </h1>
      <p className="text-wb-muted text-base mb-1">Your money. Total clarity.</p>
      <p className="text-wb-muted/60 text-sm mb-10 max-w-xs">
        Take control of every dollar — track income, expenses, bills, and goals in one premium workspace.
      </p>

      <div className="w-full space-y-3">
        <button onClick={onNext} className="btn-primary w-full text-base py-3.5">
          Get Started
          <ArrowRight size={18} />
        </button>
        <button onClick={onDemo} className="btn-secondary w-full text-base py-3.5">
          <RotateCcw size={18} />
          Load Demo Data
        </button>
      </div>

      <p className="text-wb-muted/50 text-xs mt-6">
        All data stored locally on your device. Private by default.
      </p>
    </div>
  );
}

// ─── Step 2: Setup Mode ───────────────────────────────────────────────────────
function StepSetupMode({ onManual, onDemo, onSkip }) {
  const [selected, setSelected] = useState(null);

  const options = [
    {
      id: 'manual',
      icon: <Wallet size={22} className="text-wb-blue" />,
      title: 'Manual Tracking',
      desc: 'Enter your accounts and transactions yourself for full control.',
      badge: 'Recommended',
      badgeColor: 'text-wb-blue bg-wb-blue-muted/40 border border-wb-blue/20',
      action: onManual,
    },
    {
      id: 'demo',
      icon: <LayoutDashboard size={22} className="text-wb-gold" />,
      title: 'Demo Mode',
      desc: 'Explore with pre-filled data to see all features in action.',
      badge: 'Quick preview',
      badgeColor: 'text-wb-gold bg-wb-amber-muted/30 border border-wb-gold/20',
      action: onDemo,
    },
    {
      id: 'skip',
      icon: <ArrowRight size={22} className="text-wb-muted" />,
      title: 'Skip for Now',
      desc: 'Jump straight to the dashboard and add data later.',
      badge: null,
      action: onSkip,
    },
  ];

  function handleContinue() {
    const opt = options.find(o => o.id === selected);
    if (opt) opt.action();
  }

  return (
    <div className="fade-in">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-wb-white mb-2">
          How would you like
          <br />
          to start?
        </h2>
        <p className="text-wb-muted text-sm">You can change this at any time in Settings.</p>
      </div>

      <div className="space-y-3 mb-8">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
              selected === opt.id
                ? 'border-wb-blue bg-wb-blue-muted/20 ring-1 ring-wb-blue/30'
                : 'border-wb-border bg-wb-card hover:border-wb-blue/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 bg-wb-border/50 rounded-lg shrink-0">{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-sm font-semibold text-wb-white">{opt.title}</span>
                  {opt.badge && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-wb-muted leading-relaxed">{opt.desc}</p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                  selected === opt.id ? 'border-wb-blue bg-wb-blue' : 'border-wb-border'
                }`}
              >
                {selected === opt.id && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </div>
          </button>
        ))}
      </div>

      <button onClick={handleContinue} disabled={!selected} className="btn-primary w-full">
        Continue
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ─── Step 3: Add First Account ────────────────────────────────────────────────
function StepAccount({ onAdd, onSkip }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
  const [balance, setBalance] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), type, current_balance: parseFloat(balance) || 0 });
  }

  return (
    <div className="fade-in">
      <div className="mb-6">
        <div className="w-10 h-10 rounded-xl bg-wb-blue-muted/40 border border-wb-blue/20 flex items-center justify-center mb-3">
          <Wallet size={20} className="text-wb-blue" />
        </div>
        <h2 className="text-2xl font-bold text-wb-white mb-1">Add Your First Account</h2>
        <p className="text-wb-muted text-sm">
          Link your checking, savings, or credit account to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-1">
        <Field label="Account Name">
          <input
            type="text"
            placeholder="e.g. Chase Checking"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Account Type">
          <div className="grid grid-cols-3 gap-2">
            {ACCOUNT_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                  type === value
                    ? 'border-wb-blue bg-wb-blue-muted/30 text-wb-white'
                    : 'border-wb-border bg-wb-card text-wb-muted hover:border-wb-blue/40'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Current Balance">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-wb-muted text-sm">$</span>
            <input
              type="number"
              placeholder="0.00"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              step="0.01"
              className="pl-7"
            />
          </div>
        </Field>

        <div className="pt-2 space-y-3">
          <button type="submit" disabled={!name.trim()} className="btn-primary w-full">
            <Plus size={18} />
            Add Account
          </button>
          <button type="button" onClick={onSkip} className="btn-ghost w-full justify-center text-sm">
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Step 4: First Income ─────────────────────────────────────────────────────
function StepIncome({ onAdd, onSkip }) {
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [recurring, setRecurring] = useState(true);
  const [frequency, setFrequency] = useState('monthly');

  function handleSubmit(e) {
    e.preventDefault();
    if (!source.trim() || !amount) return;
    onAdd({
      source: source.trim(),
      amount: parseFloat(amount),
      is_recurring: recurring,
      frequency: recurring ? frequency : null,
      received_date: today(),
    });
  }

  return (
    <div className="fade-in">
      <div className="mb-6">
        <div className="w-10 h-10 rounded-xl bg-wb-green-muted/40 border border-wb-green/20 flex items-center justify-center mb-3">
          <Banknote size={20} className="text-wb-green" />
        </div>
        <h2 className="text-2xl font-bold text-wb-white mb-1">Your Income</h2>
        <p className="text-wb-muted text-sm">
          Add your primary income source to set the baseline for your budget.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-1">
        <Field label="Income Source">
          <input
            type="text"
            placeholder="e.g. Salary, Freelance, Side Business"
            value={source}
            onChange={e => setSource(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Amount">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-wb-muted text-sm">$</span>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              step="0.01"
              className="pl-7"
            />
          </div>
        </Field>

        <Field label="Is this recurring?">
          <div className="flex gap-2">
            {[
              { v: true,  l: 'Yes' },
              { v: false, l: 'No, one-time' },
            ].map(({ v, l }) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setRecurring(v)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  recurring === v
                    ? 'border-wb-blue bg-wb-blue-muted/30 text-wb-white'
                    : 'border-wb-border bg-wb-card text-wb-muted hover:border-wb-blue/40'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>

        {recurring && (
          <Field label="Frequency">
            <div className="flex gap-2">
              {FREQUENCIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFrequency(value)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    frequency === value
                      ? 'border-wb-blue bg-wb-blue-muted/30 text-wb-white'
                      : 'border-wb-border bg-wb-card text-wb-muted hover:border-wb-blue/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="pt-2 space-y-3">
          <button
            type="submit"
            disabled={!source.trim() || !amount}
            className="btn-primary w-full"
          >
            <Plus size={18} />
            Add Income
          </button>
          <button type="button" onClick={onSkip} className="btn-ghost w-full justify-center text-sm">
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Step 5: Bill or Subscription ────────────────────────────────────────────
function StepBillOrSub({ onAdd, onSkip }) {
  const [tab, setTab] = useState('bill');

  const [billName, setBillName]       = useState('');
  const [billAmount, setBillAmount]   = useState('');
  const [billDueDate, setBillDueDate] = useState('');

  const [subName, setSubName]   = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subCycle, setSubCycle] = useState('monthly');

  function handleSubmit(e) {
    e.preventDefault();
    if (tab === 'bill') {
      if (!billName.trim() || !billAmount) return;
      onAdd({
        type: 'bill',
        data: {
          name: billName.trim(),
          amount: parseFloat(billAmount),
          due_date: billDueDate || today(),
          recurrence: 'monthly',
        },
      });
    } else {
      if (!subName.trim() || !subAmount) return;
      onAdd({
        type: 'subscription',
        data: {
          name: subName.trim(),
          amount: parseFloat(subAmount),
          billing_cycle: subCycle,
          next_due_date: today(),
        },
      });
    }
  }

  const isValid = tab === 'bill'
    ? billName.trim() && billAmount
    : subName.trim() && subAmount;

  return (
    <div className="fade-in">
      <div className="mb-6">
        <div className="w-10 h-10 rounded-xl bg-wb-amber-muted/40 border border-wb-amber/20 flex items-center justify-center mb-3">
          <Receipt size={20} className="text-wb-amber" />
        </div>
        <h2 className="text-2xl font-bold text-wb-white mb-1">Bills &amp; Subscriptions</h2>
        <p className="text-wb-muted text-sm">
          Track what's coming due so nothing catches you off guard.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-wb-dark rounded-xl mb-5 border border-wb-border">
        {[
          { id: 'bill', label: 'Bill',         icon: <Calendar size={14} /> },
          { id: 'sub',  label: 'Subscription', icon: <Repeat   size={14} /> },
        ].map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-wb-card text-wb-white shadow-sm border border-wb-border'
                : 'text-wb-muted hover:text-wb-white'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-1">
        {tab === 'bill' ? (
          <>
            <Field label="Bill Name">
              <input
                type="text"
                placeholder="e.g. Rent, Electricity, Internet"
                value={billName}
                onChange={e => setBillName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Amount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-wb-muted text-sm">$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={billAmount}
                  onChange={e => setBillAmount(e.target.value)}
                  step="0.01"
                  className="pl-7"
                />
              </div>
            </Field>
            <Field label="Due Date">
              <input
                type="date"
                value={billDueDate}
                onChange={e => setBillDueDate(e.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Service Name">
              <input
                type="text"
                placeholder="e.g. Netflix, Spotify, Adobe"
                value={subName}
                onChange={e => setSubName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Amount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-wb-muted text-sm">$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={subAmount}
                  onChange={e => setSubAmount(e.target.value)}
                  step="0.01"
                  className="pl-7"
                />
              </div>
            </Field>
            <Field label="Billing Cycle">
              <div className="grid grid-cols-2 gap-2">
                {BILLING_CYCLES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSubCycle(value)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      subCycle === value
                        ? 'border-wb-blue bg-wb-blue-muted/30 text-wb-white'
                        : 'border-wb-border bg-wb-card text-wb-muted hover:border-wb-blue/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        <div className="pt-2 space-y-3">
          <button type="submit" disabled={!isValid} className="btn-primary w-full">
            <Plus size={18} />
            Add {tab === 'bill' ? 'Bill' : 'Subscription'}
          </button>
          <button type="button" onClick={onSkip} className="btn-ghost w-full justify-center text-sm">
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Step 6: All Set ──────────────────────────────────────────────────────────
function StepAllSet({ added, onDone }) {
  const items = [
    added.account && {
      icon: <Wallet size={16} className="text-wb-blue" />,
      label: 'Account added',
      detail: added.account,
    },
    added.income && {
      icon: <Banknote size={16} className="text-wb-green" />,
      label: 'Income source added',
      detail: added.income,
    },
    added.billOrSub && {
      icon: <Receipt size={16} className="text-wb-amber" />,
      label: added.billOrSubType === 'bill' ? 'Bill added' : 'Subscription added',
      detail: added.billOrSub,
    },
  ].filter(Boolean);

  return (
    <div className="fade-in flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-wb-green-muted/30 border-2 border-wb-green flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.25)]">
        <CheckCircle2 size={40} className="text-wb-green" />
      </div>

      <h2 className="text-2xl font-bold text-wb-white mb-2">You're all set!</h2>
      <p className="text-wb-muted text-sm mb-8 max-w-xs">
        Your financial workspace is ready. Here's a summary of what you've set up:
      </p>

      {items.length > 0 ? (
        <div className="w-full bg-wb-card border border-wb-border rounded-xl divide-y divide-wb-border mb-8">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 text-left">
              <div className="w-8 h-8 rounded-lg bg-wb-border/50 flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-wb-muted">{item.label}</p>
                <p className="text-sm font-medium text-wb-white truncate">{item.detail}</p>
              </div>
              <CheckCircle2 size={16} className="text-wb-green shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full bg-wb-card border border-wb-border rounded-xl p-4 mb-8 text-sm text-wb-muted">
          No data added yet — you can set everything up from the dashboard anytime.
        </div>
      )}

      <div className="w-full space-y-3">
        <button onClick={onDone} className="btn-primary w-full text-base py-3.5">
          Go to Dashboard
          <ArrowRight size={18} />
        </button>
      </div>

      <p className="text-xs text-wb-muted/50 mt-5">
        Your data is stored locally and never leaves your device.
      </p>
    </div>
  );
}

// ─── Main Onboarding ──────────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate();
  const { loadSeedData, setOnboarded, addAccount, addIncome, addBill, addSubscription } =
    useFinance();

  const [step, setStep] = useState(0);
  const [added, setAdded] = useState({
    account: null,
    income: null,
    billOrSub: null,
    billOrSubType: null,
  });

  function handleDemo() {
    loadSeedData();
    setOnboarded(true);
    navigate('/');
  }

  function handleManual() {
    setStep(2);
  }

  function handleSkipSetup() {
    setOnboarded(true);
    navigate('/');
  }

  function handleAddAccount(data) {
    addAccount(data);
    setAdded(prev => ({ ...prev, account: data.name }));
    setStep(3);
  }

  function handleSkipAccount() {
    setStep(3);
  }

  function handleAddIncome(data) {
    addIncome(data);
    setAdded(prev => ({ ...prev, income: data.source }));
    setStep(4);
  }

  function handleSkipIncome() {
    setStep(4);
  }

  function handleAddBillOrSub({ type, data }) {
    if (type === 'bill') addBill(data);
    else addSubscription(data);
    setAdded(prev => ({ ...prev, billOrSub: data.name, billOrSubType: type }));
    setStep(5);
  }

  function handleSkipBillOrSub() {
    setStep(5);
  }

  function handleDone() {
    setOnboarded(true);
    navigate('/');
  }

  // Which dot is active (0-indexed active dot = step - 2 for steps 2-5, capped)
  const activeDot = step >= 2 ? Math.min(step - 2, TOTAL_DOTS - 1) : 0;
  const showProgress = step >= 2 && step <= 4;
  const showBack = step >= 1 && step <= 4;

  return (
    <div className="min-h-screen bg-wb-black flex flex-col">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-wb-blue/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-wb-purple/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col max-w-lg mx-auto w-full px-5">
        {showProgress && <ProgressDots active={activeDot} />}

        {showBack && (
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            className="btn-ghost self-start mb-2 -ml-1 text-sm mt-2"
          >
            ← Back
          </button>
        )}

        <div className="flex-1 flex flex-col justify-center py-4">
          {step === 0 && <StepWelcome onNext={() => setStep(1)} onDemo={handleDemo} />}
          {step === 1 && (
            <StepSetupMode
              onManual={handleManual}
              onDemo={handleDemo}
              onSkip={handleSkipSetup}
            />
          )}
          {step === 2 && <StepAccount onAdd={handleAddAccount} onSkip={handleSkipAccount} />}
          {step === 3 && <StepIncome  onAdd={handleAddIncome}  onSkip={handleSkipIncome} />}
          {step === 4 && <StepBillOrSub onAdd={handleAddBillOrSub} onSkip={handleSkipBillOrSub} />}
          {step === 5 && <StepAllSet added={added} onDone={handleDone} />}
        </div>
      </div>
    </div>
  );
}
