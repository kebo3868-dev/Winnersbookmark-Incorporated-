import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Plus, CheckCircle2, SkipForward, Info } from 'lucide-react';
import { followupsDB, leadsDB } from '../lib/database';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { formatDate, today, addDays } from '../utils/formatters';
import type { Lead, FollowUp, FollowUpStatus } from '../types';

type Tab = 'due' | 'upcoming' | 'completed';

const STATUS_COLORS: Record<FollowUpStatus, string> = {
  'Scheduled': 'chip-blue',
  'Due Today': 'chip-gold',
  'Completed': 'bg-success/10 border-success/30 text-success inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
  'Skipped': 'bg-ink-card border-ink-line text-ghost inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
  'Do Not Contact': 'bg-danger/10 border-danger/30 text-danger inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
};

const FOLLOWUP_TYPES = ['Email', 'Phone Call', 'LinkedIn', 'Text Message', 'Other'];

interface FollowUpWithLead extends FollowUp {
  lead?: Lead;
}

export default function FollowUps() {
  const { toast } = useToast();
  const [followups, setFollowups] = useState<FollowUpWithLead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tab, setTab] = useState<Tab>('due');
  const [showModal, setShowModal] = useState(false);
  const todayStr = today();

  // New follow-up form
  const [form, setForm] = useState({
    lead_id: '',
    scheduled_date: todayStr,
    followup_type: 'Email',
    notes: '',
  });

  function reload() {
    const allLeads = leadsDB.getAll();
    const allFU = followupsDB.getAll().map(fu => ({
      ...fu,
      lead: allLeads.find(l => l.id === fu.lead_id),
    }));
    setLeads(allLeads.filter(l => !l.opt_out && l.crm_stage !== 'Do Not Contact'));
    setFollowups(allFU);
  }

  useEffect(() => { reload(); }, []);

  const dueToday = followups.filter(f =>
    f.scheduled_date === todayStr && f.status !== 'Completed' && f.status !== 'Skipped'
  );
  const upcoming = followups.filter(f =>
    f.scheduled_date > todayStr && f.status !== 'Completed' && f.status !== 'Skipped'
  ).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const completed = followups.filter(f =>
    f.status === 'Completed' || f.status === 'Skipped'
  ).sort((a, b) => b.created_at.localeCompare(a.created_at));

  const tabData: Record<Tab, FollowUpWithLead[]> = { due: dueToday, upcoming, completed };
  const currentList = tabData[tab];

  function handleComplete(id: string) {
    followupsDB.complete(id);
    reload();
    toast('Follow-up marked complete', 'success');
  }

  function handleSkip(id: string) {
    followupsDB.update(id, { status: 'Skipped' });
    reload();
    toast('Follow-up skipped', 'info');
  }

  function handleAdd(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.lead_id) { toast('Select a lead', 'warning'); return; }
    const existingCount = followupsDB.getByLead(form.lead_id).length;
    followupsDB.create({
      lead_id: form.lead_id,
      followup_number: existingCount + 1,
      scheduled_date: form.scheduled_date,
      followup_type: form.followup_type,
      status: form.scheduled_date === todayStr ? 'Due Today' : 'Scheduled',
      notes: form.notes,
    });
    reload();
    toast('Follow-up scheduled', 'success');
    setShowModal(false);
    setForm({ lead_id: '', scheduled_date: todayStr, followup_type: 'Email', notes: '' });
  }

  return (
    <div className="max-w-3xl mx-auto pb-16 fade-in">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Outreach</p>
          <h1 className="display-title text-paper">Follow-Ups</h1>
          <p className="text-mist text-sm mt-1">{dueToday.length} due today · {upcoming.length} upcoming</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-gold shrink-0">
          <Plus size={15} /> Add Follow-Up
        </button>
      </div>

      {/* Cadence info */}
      <div className="flex items-start gap-2.5 p-3.5 bg-electric/5 border border-electric/20 rounded-xl mb-5 text-sm">
        <Info size={15} className="text-electric shrink-0 mt-0.5" />
        <p className="text-chalk">
          <strong className="text-paper">Suggested cadence:</strong> Follow-up 1: 2 days after first email · Follow-up 2: 5 days · Final: 10 days
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-card/60 rounded-xl border border-ink-line mb-5 w-fit">
        {([
          ['due', `Due Today (${dueToday.length})`],
          ['upcoming', `Upcoming (${upcoming.length})`],
          ['completed', `Completed (${completed.length})`],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-gold text-ink-black' : 'text-mist hover:text-paper'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {currentList.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={tab === 'due' ? 'No follow-ups due today' : tab === 'upcoming' ? 'No upcoming follow-ups' : 'No completed follow-ups'}
          description={tab === 'due' ? "You're all caught up. Add a follow-up or check the upcoming tab." : undefined}
          action={tab !== 'completed' ? (
            <button onClick={() => setShowModal(true)} className="btn-gold">
              <Plus size={14} /> Add Follow-Up
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {currentList.map(fu => (
            <div key={fu.id} className={`glass p-4 ${fu.scheduled_date === todayStr && fu.status !== 'Completed' ? 'border-gold/20' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {fu.lead ? (
                      <Link to={`/leads/${fu.lead_id}`} className="font-semibold text-paper hover:text-gold-light transition-colors text-sm">
                        {fu.lead.restaurant_name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-mist text-sm">Unknown Lead</span>
                    )}
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${fu.status === 'Completed' ? 'bg-success/10 border-success/30 text-success' : fu.status === 'Skipped' ? 'bg-ink-card border-ink-line text-ghost' : fu.scheduled_date === todayStr ? 'bg-gold/10 border-gold/30 text-gold-light' : 'bg-electric/10 border-electric/30 text-electric-glow'}`}>
                      {fu.status === 'Completed' || fu.status === 'Skipped' ? fu.status : fu.scheduled_date === todayStr ? 'Due Today' : 'Scheduled'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-mist">
                    <span>Follow-Up #{fu.followup_number}</span>
                    <span>{fu.followup_type}</span>
                    <span>{formatDate(fu.scheduled_date)}</span>
                  </div>
                  {fu.notes && <p className="text-xs text-chalk mt-1.5 leading-relaxed">{fu.notes}</p>}
                </div>
                {fu.status !== 'Completed' && fu.status !== 'Skipped' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleComplete(fu.id)} className="btn-ghost text-xs px-3 py-1.5 text-success border-success/30 hover:border-success">
                      <CheckCircle2 size={13} /> Done
                    </button>
                    <button onClick={() => handleSkip(fu.id)} className="btn-ghost text-xs px-3 py-1.5">
                      <SkipForward size={13} /> Skip
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Schedule Follow-Up">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="label">Restaurant *</label>
            <select value={form.lead_id} onChange={e => setForm(p => ({ ...p, lead_id: e.target.value }))}>
              <option value="">— Select a lead —</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.restaurant_name} · {l.city}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Scheduled Date *</label>
            <input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Follow-Up Type</label>
            <select value={form.followup_type} onChange={e => setForm(p => ({ ...p, followup_type: e.target.value }))}>
              {FOLLOWUP_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="What's the plan for this follow-up?" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-gold flex-1">Schedule</button>
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
