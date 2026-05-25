import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Plus, CheckCircle2, TrendingUp } from 'lucide-react';
import { trialsDB, leadsDB } from '../lib/database';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { formatDate, today, addDays } from '../utils/formatters';
import { TRIAL_FEATURES, TRIAL_SUCCESS_CRITERIA } from '../types';
import type { Lead, Trial, TrialStatus } from '../types';

interface TrialWithLead extends Trial {
  lead?: Lead;
  daysRemaining?: number;
}

const STATUS_COLORS: Record<TrialStatus, string> = {
  'Offered': 'bg-electric/10 border-electric/30 text-electric-glow',
  'Accepted': 'bg-gold/10 border-gold/30 text-gold-light',
  'Active': 'bg-success/10 border-success/30 text-success',
  'Completed': 'bg-ink-card border-ink-line text-mist',
  'Converted': 'bg-success/15 border-success/40 text-success',
  'Not Converted': 'bg-danger/10 border-danger/30 text-danger',
};

export default function Trials() {
  const { toast } = useToast();
  const [trials, setTrials] = useState<TrialWithLead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState<string | null>(null);

  // Add form
  const [form, setForm] = useState({
    lead_id: '',
    trial_start_date: today(),
    trial_end_date: addDays(today(), 14),
    features_included: [] as string[],
    success_criteria: [] as string[],
    notes: '',
  });

  function reload() {
    const allLeads = leadsDB.getAll();
    const trialIds = new Set(trialsDB.getAll().map(t => t.lead_id));
    setLeads(allLeads.filter(l => !l.opt_out && l.crm_stage !== 'Do Not Contact'));

    const now = new Date();
    setTrials(trialsDB.getAll().map(t => {
      const end = t.trial_end_date ? new Date(t.trial_end_date) : null;
      const days = end ? Math.ceil((end.getTime() - now.getTime()) / 86400000) : undefined;
      return { ...t, lead: allLeads.find(l => l.id === t.lead_id), daysRemaining: days };
    }).sort((a, b) => {
      const order: TrialStatus[] = ['Active', 'Accepted', 'Offered', 'Completed', 'Converted', 'Not Converted'];
      return order.indexOf(a.trial_status) - order.indexOf(b.trial_status);
    }));
  }

  useEffect(() => { reload(); }, []);

  const stats = {
    offered: trials.filter(t => t.trial_status === 'Offered').length,
    active: trials.filter(t => t.trial_status === 'Active' || t.trial_status === 'Accepted').length,
    converted: trials.filter(t => t.trial_status === 'Converted').length,
    notConverted: trials.filter(t => t.trial_status === 'Not Converted').length,
  };

  function toggleFeature(f: string) {
    setForm(p => ({
      ...p,
      features_included: p.features_included.includes(f)
        ? p.features_included.filter(x => x !== f)
        : [...p.features_included, f],
    }));
  }

  function toggleCriteria(c: string) {
    setForm(p => ({
      ...p,
      success_criteria: p.success_criteria.includes(c)
        ? p.success_criteria.filter(x => x !== c)
        : [...p.success_criteria, c],
    }));
  }

  function handleAdd(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.lead_id) { toast('Select a lead', 'warning'); return; }
    trialsDB.create({
      lead_id: form.lead_id,
      trial_start_date: form.trial_start_date,
      trial_end_date: form.trial_end_date,
      trial_status: 'Offered',
      features_included: form.features_included,
      success_criteria: form.success_criteria,
      conversion_status: '',
      notes: form.notes,
    });
    leadsDB.updateStage(form.lead_id, 'Trial Offered');
    reload();
    toast('Trial offered — lead stage updated', 'success');
    setShowAddModal(false);
    setForm({ lead_id: '', trial_start_date: today(), trial_end_date: addDays(today(), 14), features_included: [], success_criteria: [], notes: '' });
  }

  function handleStatusUpdate(id: string, status: TrialStatus) {
    const trial = trialsDB.getById(id);
    if (!trial) return;
    trialsDB.update(id, { trial_status: status });
    if (status === 'Active') leadsDB.updateStage(trial.lead_id, 'Trial Started');
    if (status === 'Converted') leadsDB.updateStage(trial.lead_id, 'Closed Won');
    reload();
    toast(`Trial status updated to ${status}`, 'success');
    setShowUpdateModal(null);
  }

  const updateTrial = trials.find(t => t.id === showUpdateModal);

  return (
    <div className="max-w-3xl mx-auto pb-16 fade-in">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Pilots</p>
          <h1 className="display-title text-paper">14-Day Trials</h1>
          <p className="text-mist text-sm mt-1">Track AI Front Desk Pilots from offer to conversion.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-gold shrink-0">
          <Plus size={15} /> Offer Trial
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Offered', value: stats.offered, color: 'text-electric' },
          { label: 'Active', value: stats.active, color: 'text-success' },
          { label: 'Converted', value: stats.converted, color: 'text-gold' },
          { label: 'Not Converted', value: stats.notConverted, color: 'text-danger' },
        ].map(s => (
          <div key={s.label} className="glass p-3 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-mist uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {trials.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No trials yet"
          description="Offer a 14-day AI Front Desk Pilot to a qualified lead after a successful audit."
          action={<button onClick={() => setShowAddModal(true)} className="btn-gold"><Plus size={14} /> Offer Trial</button>}
        />
      ) : (
        <div className="space-y-4">
          {trials.map(trial => (
            <div key={trial.id} className={`glass p-5 ${trial.trial_status === 'Active' ? 'border-success/30' : trial.trial_status === 'Converted' ? 'border-gold/30' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  {trial.lead ? (
                    <Link to={`/leads/${trial.lead_id}`} className="font-bold text-paper hover:text-gold-light transition-colors">
                      {trial.lead.restaurant_name}
                    </Link>
                  ) : (
                    <p className="font-bold text-mist">Unknown Lead</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-mist mt-1">
                    <span>{formatDate(trial.trial_start_date)} → {formatDate(trial.trial_end_date)}</span>
                    {trial.daysRemaining !== undefined && trial.trial_status === 'Active' && (
                      <span className={trial.daysRemaining <= 3 ? 'text-danger font-semibold' : 'text-gold'}>
                        {trial.daysRemaining > 0 ? `${trial.daysRemaining}d remaining` : 'Ended'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[trial.trial_status]}`}>
                    {trial.trial_status}
                  </span>
                  {trial.trial_status !== 'Converted' && trial.trial_status !== 'Not Converted' && (
                    <button onClick={() => setShowUpdateModal(trial.id)} className="btn-ghost text-xs px-3 py-1.5">
                      Update
                    </button>
                  )}
                </div>
              </div>

              {trial.features_included.length > 0 && (
                <div className="mb-3">
                  <p className="label">Pilot Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trial.features_included.map(f => <span key={f} className="chip text-[10px]">{f}</span>)}
                  </div>
                </div>
              )}

              {trial.success_criteria.length > 0 && (
                <div>
                  <p className="label">Success Criteria</p>
                  <div className="space-y-1">
                    {trial.success_criteria.map(c => (
                      <div key={c} className="flex items-center gap-2 text-xs text-chalk">
                        <CheckCircle2 size={12} className="text-success/60 shrink-0" />
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trial.notes && (
                <p className="text-xs text-mist mt-3 leading-relaxed border-t border-ink-line pt-3">{trial.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Offer 14-Day Trial" size="lg">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="label">Restaurant *</label>
            <select value={form.lead_id} onChange={e => setForm(p => ({ ...p, lead_id: e.target.value }))}>
              <option value="">— Select a lead —</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.restaurant_name} · {l.city}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input type="date" value={form.trial_start_date}
                onChange={e => setForm(p => ({ ...p, trial_start_date: e.target.value, trial_end_date: addDays(e.target.value, 14) }))} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" value={form.trial_end_date}
                onChange={e => setForm(p => ({ ...p, trial_end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Features Included</label>
            <div className="space-y-2">
              {TRIAL_FEATURES.map(f => (
                <label key={f} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.features_included.includes(f)} onChange={() => toggleFeature(f)}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-chalk">{f}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Success Criteria</label>
            <div className="space-y-2">
              {TRIAL_SUCCESS_CRITERIA.map(c => (
                <label key={c} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.success_criteria.includes(c)} onChange={() => toggleCriteria(c)}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-chalk">{c}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-gold flex-1">Offer Trial</button>
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      {updateTrial && (
        <Modal open={!!showUpdateModal} onClose={() => setShowUpdateModal(null)} title="Update Trial Status" size="sm">
          <p className="text-mist text-sm mb-4">{updateTrial.lead?.restaurant_name}</p>
          <div className="space-y-2">
            {(['Offered', 'Accepted', 'Active', 'Completed', 'Converted', 'Not Converted'] as TrialStatus[]).map(s => (
              <button
                key={s}
                onClick={() => handleStatusUpdate(updateTrial.id, s)}
                className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${updateTrial.trial_status === s ? 'border-gold/60 bg-gold/10 text-gold-light' : 'border-ink-line bg-ink-card/40 text-chalk hover:border-electric/40 hover:text-paper'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
