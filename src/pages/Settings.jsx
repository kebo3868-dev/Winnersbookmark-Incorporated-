import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, DollarSign, Trash2, RefreshCw,
  ChevronRight, Shield, Bell, Palette, Database,
  AlertTriangle, CheckCircle2, ExternalLink,
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useFinance } from '../context/FinanceContext';
import { storage } from '../data/storage';
import { today } from '../lib/finance';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <p className="label px-1 mb-2">{title}</p>
      <div className="card divide-y divide-wb-border/50 p-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ icon: Icon, label, sub, value, onClick, color = 'text-wb-blue-light', danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-wb-border/30 transition-colors text-left ${danger ? 'hover:bg-wb-red/5' : ''}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${danger ? 'bg-wb-red/10' : 'bg-wb-card2'}`}>
        <Icon size={15} className={danger ? 'text-wb-red-light' : color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-wb-red-light' : 'text-wb-white'}`}>{label}</p>
        {sub && <p className="text-xs text-wb-muted truncate">{sub}</p>}
      </div>
      {value && <p className="text-sm text-wb-muted shrink-0">{value}</p>}
      <ChevronRight size={14} className="text-wb-muted shrink-0" />
    </button>
  );
}

// ─── Profile Form ─────────────────────────────────────────────────────────────

function ProfileForm({ profile, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:     profile?.name     || '',
    email:    profile?.email    || '',
    currency: profile?.currency || 'USD',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name.trim();

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" autoFocus />
      </div>
      <div>
        <label className="label">Email (optional)</label>
        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
      </div>
      <div>
        <label className="label">Currency</label>
        <select value={form.currency} onChange={e => set('currency', e.target.value)}>
          {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'MXN', 'INR'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button onClick={() => valid && onSave(form)} disabled={!valid} className="btn-primary flex-1">
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Settings() {
  const navigate   = useNavigate();
  const { profile, setProfile, setOnboarded, loadSeedData,
          accounts, income, expenses, subscriptions, bills, goals } = useFinance();

  const [modal, setModal] = useState(null); // null | 'profile' | 'reset' | 'seed'
  const [resetDone, setResetDone] = useState(false);

  function handleSaveProfile(data) {
    setProfile({ ...profile, ...data, updated_at: today() });
    setModal(null);
  }

  function handleReset() {
    storage.clearAll();
    window.location.reload();
  }

  function handleLoadSeed() {
    loadSeedData();
    setModal(null);
  }

  const stats = [
    { label: 'Accounts',      value: accounts.length      },
    { label: 'Income Records',  value: income.length        },
    { label: 'Expenses',       value: expenses.length      },
    { label: 'Subscriptions',  value: subscriptions.length },
    { label: 'Bills',          value: bills.length         },
    { label: 'Goals',          value: goals.length         },
  ];

  return (
    <Layout>
      <div className="page-container space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        </div>

        {/* Profile card */}
        <div
          className="rounded-2xl p-5 cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#0a0a0f 100%)', border: '1px solid rgba(59,130,246,0.25)' }}
          onClick={() => setModal('profile')}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-wb-blue/25 border border-wb-blue/30 flex items-center justify-center text-2xl font-bold text-wb-blue-glow">
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-wb-white">{profile?.name || 'Set your name'}</p>
              <p className="text-xs text-wb-muted">{profile?.email || 'No email set'}</p>
              <p className="text-xs text-wb-blue-light mt-0.5">Currency: {profile?.currency || 'USD'}</p>
            </div>
            <ChevronRight size={16} className="text-wb-muted" />
          </div>
        </div>

        {/* Data section */}
        <Section title="Data">
          <SettingsRow
            icon={Database}
            label="Load Demo Data"
            sub="Populate with realistic sample data"
            color="text-wb-blue-light"
            onClick={() => setModal('seed')}
          />
          <SettingsRow
            icon={RefreshCw}
            label="Restart Onboarding"
            sub="Go through the setup flow again"
            color="text-wb-purple"
            onClick={() => { setOnboarded(false); navigate('/'); }}
          />
        </Section>

        {/* Data stats */}
        <div className="card">
          <p className="label mb-3">Your Data Summary</p>
          <div className="grid grid-cols-3 gap-3">
            {stats.map(({ label, value }) => (
              <div key={label} className="text-center bg-wb-card2 rounded-xl py-3 px-2">
                <p className="text-lg font-bold text-wb-white">{value}</p>
                <p className="text-[10px] text-wb-muted leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* App info */}
        <Section title="About">
          <SettingsRow
            icon={Shield}
            label="Winnersbookmark Financial"
            sub="Premium personal finance app"
            value="v1.0"
            color="text-wb-blue-light"
            onClick={() => {}}
          />
        </Section>

        {/* Danger zone */}
        <Section title="Danger Zone">
          <SettingsRow
            icon={Trash2}
            label="Reset All Data"
            sub="Permanently delete everything"
            danger
            onClick={() => setModal('reset')}
          />
        </Section>

        {/* Disclaimer */}
        <div className="rounded-xl bg-wb-card2 border border-wb-border p-4">
          <p className="text-[11px] text-wb-muted leading-relaxed">
            Winnersbookmark Financial is a personal money tracking tool. It does not connect to your bank,
            provide financial advice, or store data on external servers. All data is saved locally in your browser.
          </p>
        </div>

        {/* Profile Modal */}
        <Modal open={modal === 'profile'} onClose={() => setModal(null)} title="Edit Profile">
          <ProfileForm profile={profile} onSave={handleSaveProfile} onCancel={() => setModal(null)} />
        </Modal>

        {/* Seed Modal */}
        <Modal open={modal === 'seed'} onClose={() => setModal(null)} title="Load Demo Data">
          <div className="space-y-4">
            <div className="rounded-xl bg-wb-blue/5 border border-wb-blue/20 p-4">
              <p className="text-sm text-wb-white mb-2">This will load realistic sample data including:</p>
              <ul className="text-xs text-wb-muted space-y-1">
                <li>• 3 bank accounts</li>
                <li>• Income records (salary + freelance)</li>
                <li>• Recent expenses across categories</li>
                <li>• Subscriptions (Netflix, Spotify, etc.)</li>
                <li>• Monthly bills (rent, utilities, etc.)</li>
                <li>• Budget categories</li>
                <li>• Savings goals</li>
              </ul>
            </div>
            <p className="text-xs text-wb-amber">⚠ This will replace your existing data.</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleLoadSeed} className="btn-primary flex-1">Load Demo Data</button>
            </div>
          </div>
        </Modal>

        {/* Reset Modal */}
        <Modal open={modal === 'reset'} onClose={() => setModal(null)} title="Reset All Data">
          <div className="space-y-4">
            <div className="rounded-xl bg-wb-red/5 border border-wb-red/20 p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-wb-red-light shrink-0 mt-0.5" />
              <p className="text-sm text-wb-white">
                This will permanently delete all your accounts, transactions, budgets, goals, and settings.
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleReset}
                className="flex-1 bg-wb-red hover:bg-wb-red-light text-white font-semibold px-6 py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Delete Everything
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </Layout>
  );
}
