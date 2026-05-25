import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Ban, Trash2, Phone, Mail, Globe, MapPin,
  Star, Zap, Calendar, CheckCircle2, Send, Clock, Trophy,
  XCircle, ExternalLink, ChevronDown,
} from 'lucide-react';
import { leadsDB, auditsDB, emailDraftsDB, followupsDB, trialsDB } from '../lib/database';
import { useToast } from '../context/ToastContext';
import { PageLoading } from '../components/LoadingSpinner';
import ScoreBadge from '../components/ScoreBadge';
import StageChip from '../components/StageChip';
import Modal from '../components/Modal';
import { formatDate, formatPhone, formatRelative, today, addDays } from '../utils/formatters';
import { CRM_STAGES, TRIAL_FEATURES, TRIAL_SUCCESS_CRITERIA } from '../types';
import type { Lead, Audit, EmailDraft, FollowUp, Trial, CRMStage, FollowUpStatus } from '../types';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Follow-up form
  const [fuDate, setFuDate] = useState(today());
  const [fuType, setFuType] = useState('Email');
  const [fuNotes, setFuNotes] = useState('');

  // Trial form
  const [trialStart, setTrialStart] = useState(today());
  const [trialEnd, setTrialEnd] = useState(addDays(today(), 14));
  const [trialFeatures, setTrialFeatures] = useState<string[]>([]);
  const [trialCriteria, setTrialCriteria] = useState<string[]>([]);
  const [trialNotes, setTrialNotes] = useState('');

  function refresh() {
    if (!id) return;
    const l = leadsDB.getById(id);
    setLead(l ?? null);
    setAudits(auditsDB.getByLead(id));
    setDrafts(emailDraftsDB.getByLead(id));
    setFollowups(followupsDB.getByLead(id));
    setTrials(trialsDB.getByLead(id));
  }

  useEffect(() => {
    refresh();
    setLoading(false);
  }, [id]);

  if (loading) return <PageLoading />;
  if (!lead) return (
    <div className="max-w-3xl mx-auto px-4 pt-12 text-center">
      <p className="section-title text-chalk mb-3">Lead not found</p>
      <Link to="/leads" className="btn-ghost text-sm">Back to Leads</Link>
    </div>
  );

  function handleMarkOptOut() {
    if (!id) return;
    leadsDB.markOptOut(id);
    refresh();
    toast('Lead marked as Do Not Contact', 'warning');
  }

  function handleDelete() {
    if (!id) return;
    leadsDB.delete(id);
    toast('Lead deleted', 'info');
    navigate('/leads');
  }

  function handleMoveStage(stage: CRMStage) {
    if (!id) return;
    leadsDB.updateStage(id, stage);
    refresh();
    setShowStageModal(false);
    toast(`Stage updated to "${stage}"`, 'success');
  }

  function handleSaveFollowUp() {
    if (!id || !fuDate) return;
    const existing = followupsDB.getByLead(id);
    followupsDB.create({
      lead_id: id,
      followup_number: existing.length + 1,
      scheduled_date: fuDate,
      followup_type: fuType,
      status: fuDate === today() ? 'Due Today' : 'Scheduled',
      notes: fuNotes,
    });
    refresh();
    setShowFollowUpModal(false);
    setFuDate(today());
    setFuType('Email');
    setFuNotes('');
    toast('Follow-up scheduled', 'success');
  }

  function handleSaveTrial() {
    if (!id) return;
    trialsDB.create({
      lead_id: id,
      trial_start_date: trialStart,
      trial_end_date: trialEnd,
      trial_status: 'Offered',
      features_included: trialFeatures,
      success_criteria: trialCriteria,
      conversion_status: '',
      notes: trialNotes,
    });
    leadsDB.updateStage(id, 'Trial Offered');
    refresh();
    setShowTrialModal(false);
    toast('Trial offered!', 'success');
  }

  function handleApproveDraft(draftId: string) {
    emailDraftsDB.approve(draftId);
    refresh();
    toast('Draft approved', 'success');
  }

  function handleMarkSent(draftId: string) {
    emailDraftsDB.markSent(draftId);
    if (id) leadsDB.updateStage(id, 'Email Sent');
    refresh();
    toast('Email marked as sent', 'success');
  }

  function handleCompleteFollowUp(fuId: string) {
    followupsDB.complete(fuId);
    refresh();
    toast('Follow-up completed', 'success');
  }

  function toggleFeature(f: string) {
    setTrialFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }

  function toggleCriteria(c: string) {
    setTrialCriteria(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  const ynLabel = (v: string) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Unknown';
  const ynColor = (v: string) => v === 'yes' ? 'text-success' : v === 'no' ? 'text-danger' : 'text-mist';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-32 pt-5 fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link to="/leads" className="icon-btn w-9 h-9 mt-1 shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <p className="eyebrow mb-1">Lead Profile</p>
            <h1 className="display-title text-paper leading-tight">{lead.restaurant_name}</h1>
            <p className="text-mist text-sm mt-1">
              {lead.city}{lead.cuisine ? ` · ${lead.cuisine}` : ''}{lead.rating > 0 ? ` · ★ ${lead.rating}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to={`/leads/${id}/edit`} className="btn-ghost text-sm px-3 py-2">
            <Edit2 size={13} /> Edit
          </Link>
          <button onClick={handleMarkOptOut} className="btn-ghost text-sm px-3 py-2 text-danger border-danger/30 hover:border-danger/60">
            <Ban size={13} /> Do Not Contact
          </button>
          <button onClick={() => setShowDeleteModal(true)} className="icon-btn w-9 h-9 text-danger border-danger/20 hover:border-danger/60">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Contact Info */}
        <div className="glass p-5 space-y-3">
          <h3 className="section-title">Contact Info</h3>
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-chalk hover:text-paper transition-colors">
              <Phone size={14} className="text-mist shrink-0" /> {formatPhone(lead.phone)}
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-electric hover:text-electric-glow transition-colors">
              <Mail size={14} className="text-mist shrink-0" /> {lead.email}
            </a>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-electric hover:text-electric-glow transition-colors">
              <Globe size={14} className="text-mist shrink-0" /> <span className="truncate">{lead.website}</span>
              <ExternalLink size={11} className="shrink-0" />
            </a>
          )}
          {lead.address && (
            <div className="flex items-start gap-2 text-sm text-chalk">
              <MapPin size={14} className="text-mist shrink-0 mt-0.5" /> {lead.address}
            </div>
          )}
          {lead.google_maps_url && (
            <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className="text-xs text-electric hover:underline flex items-center gap-1">
              <MapPin size={11} /> View on Google Maps
            </a>
          )}
          {!lead.phone && !lead.email && !lead.website && !lead.address && (
            <p className="text-mist text-sm">No contact info saved.</p>
          )}
        </div>

        {/* Restaurant Details */}
        <div className="glass p-5 space-y-3">
          <h3 className="section-title">Restaurant Details</h3>
          {lead.cuisine && <p className="text-sm text-chalk"><span className="text-mist">Cuisine:</span> {lead.cuisine}</p>}
          {lead.rating > 0 && (
            <p className="text-sm text-chalk flex items-center gap-1.5">
              <Star size={13} className="text-gold fill-gold" />
              {lead.rating} · {lead.review_count} reviews
            </p>
          )}
          {lead.lead_source && <p className="text-sm text-chalk"><span className="text-mist">Source:</span> {lead.lead_source}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {([
              ['Online Ordering', lead.has_online_ordering],
              ['Reservations', lead.has_reservations],
              ['Catering Page', lead.has_catering_page],
              ['Contact Form', lead.has_contact_form],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="text-xs">
                <span className="text-mist">{label}: </span>
                <span className={ynColor(val)}>{ynLabel(val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CRM Status */}
        <div className="glass p-5 space-y-3">
          <h3 className="section-title">CRM Status</h3>
          <div className="flex items-center gap-2">
            <StageChip stage={lead.crm_stage} />
            {lead.opt_out && <span className="chip text-danger border-danger/30">Opt-Out</span>}
          </div>
          {lead.last_contacted_at && (
            <p className="text-sm text-chalk"><span className="text-mist">Last contacted:</span> {formatRelative(lead.last_contacted_at)}</p>
          )}
          {lead.next_followup_at && (
            <p className="text-sm text-chalk"><span className="text-mist">Next follow-up:</span> {formatDate(lead.next_followup_at)}</p>
          )}
          {lead.notes && (
            <div className="pt-1">
              <p className="label">Notes</p>
              <p className="text-sm text-chalk leading-relaxed">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Bottleneck Score */}
        <div className="glass p-5 space-y-3">
          <h3 className="section-title">Bottleneck Score</h3>
          <ScoreBadge score={lead.bottleneck_score} size="lg" showBar />
          {lead.recommended_offer && (
            <p className="text-sm text-gold-light font-medium">{lead.recommended_offer}</p>
          )}
          {lead.top_bottlenecks && lead.top_bottlenecks.length > 0 && (
            <div>
              <p className="label mt-2">Top Bottlenecks</p>
              <ul className="space-y-1.5">
                {lead.top_bottlenecks.map((b, i) => (
                  <li key={i} className="text-xs text-chalk flex items-start gap-2">
                    <span className="text-danger mt-0.5 shrink-0">▸</span> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass p-5">
        <h3 className="section-title mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Link to={`/audit/${id}`} className="btn-gold text-sm px-4 py-2.5">
            <Zap size={14} /> Run Bottleneck Audit
          </Link>
          <Link to={`/emails/${id}`} className="btn-primary text-sm px-4 py-2.5">
            <Mail size={14} /> Generate Email Draft
          </Link>
          <button onClick={() => setShowFollowUpModal(true)} className="btn-ghost text-sm px-4 py-2.5">
            <Clock size={14} /> Schedule Follow-Up
          </button>
          <button onClick={() => setShowTrialModal(true)} className="btn-ghost text-sm px-4 py-2.5">
            <Calendar size={14} /> Start 14-Day Trial
          </button>
          <button onClick={() => setShowStageModal(true)} className="btn-ghost text-sm px-4 py-2.5">
            <ChevronDown size={14} /> Move Stage
          </button>
          <button onClick={() => handleMoveStage('Closed Won')} className="btn-ghost text-sm px-4 py-2.5 text-success border-success/30 hover:border-success/60">
            <Trophy size={14} /> Mark Closed Won
          </button>
          <button onClick={() => handleMoveStage('Closed Lost')} className="btn-ghost text-sm px-4 py-2.5 text-danger border-danger/30 hover:border-danger/60">
            <XCircle size={14} /> Mark Closed Lost
          </button>
        </div>
      </div>

      {/* Audit History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">Audit History</h3>
          <Link to={`/audit/${id}`} className="text-xs text-electric hover:text-electric-glow">+ New Audit</Link>
        </div>
        {audits.length === 0 ? (
          <div className="glass p-6 text-center">
            <p className="text-mist text-sm">No audits yet. <Link to={`/audit/${id}`} className="text-electric hover:underline">Run an AI Audit</Link></p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...audits].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(audit => (
              <div key={audit.id} className="glass p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-mist mb-1">{formatDate(audit.created_at)}</p>
                    <ScoreBadge score={audit.bottleneck_score} size="sm" />
                  </div>
                  <div className="text-right text-xs text-mist space-x-4">
                    <span>Digital: {audit.digital_presence_score}</span>
                    <span>Friction: {audit.customer_friction_score}</span>
                    <span>Revenue: {audit.revenue_capture_score}</span>
                    <span>AI Opp: {audit.ai_opportunity_score}</span>
                  </div>
                </div>
                {audit.audit_summary && <p className="text-sm text-chalk mt-3 leading-relaxed">{audit.audit_summary}</p>}
                {audit.top_bottlenecks?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {audit.top_bottlenecks.map((b, i) => (
                      <li key={i} className="text-xs text-mist flex items-start gap-1.5">
                        <span className="text-danger">▸</span> {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Drafts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">Email Drafts</h3>
          <Link to={`/emails/${id}`} className="text-xs text-electric hover:text-electric-glow">+ Generate Draft</Link>
        </div>
        {drafts.length === 0 ? (
          <div className="glass p-6 text-center">
            <p className="text-mist text-sm">No drafts yet. <Link to={`/emails/${id}`} className="text-electric hover:underline">Generate an email draft</Link></p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...drafts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(draft => (
              <div key={draft.id} className="glass p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`chip text-xs ${draft.status === 'Approved' ? 'text-success border-success/30' : draft.status === 'Sent' ? 'text-electric border-electric/30' : ''}`}>
                        {draft.status}
                      </span>
                      <span className="text-xs text-mist">{draft.email_type}</span>
                    </div>
                    <p className="text-sm font-semibold text-paper truncate">{draft.subject}</p>
                    <p className="text-xs text-mist mt-0.5">{formatDate(draft.created_at)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {draft.status === 'Draft' && (
                      <button onClick={() => handleApproveDraft(draft.id)} className="btn-ghost text-xs px-3 py-1.5 text-success border-success/30">
                        <CheckCircle2 size={12} /> Approve
                      </button>
                    )}
                    {draft.status === 'Approved' && (
                      <button onClick={() => handleMarkSent(draft.id)} className="btn-ghost text-xs px-3 py-1.5 text-electric border-electric/30">
                        <Send size={12} /> Mark Sent
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Follow-Ups */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">Follow-Ups</h3>
          <button onClick={() => setShowFollowUpModal(true)} className="text-xs text-electric hover:text-electric-glow">+ Schedule</button>
        </div>
        {followups.length === 0 ? (
          <div className="glass p-6 text-center">
            <p className="text-mist text-sm">No follow-ups scheduled.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...followups].sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()).map(fu => (
              <div key={fu.id} className="glass p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`chip text-xs ${fu.status === 'Completed' ? 'text-success border-success/30' : fu.status === 'Due Today' ? 'text-danger border-danger/30' : ''}`}>
                      #{fu.followup_number} — {fu.status}
                    </span>
                    <span className="text-xs text-mist">{fu.followup_type}</span>
                  </div>
                  <p className="text-xs text-chalk">{formatDate(fu.scheduled_date)}</p>
                  {fu.notes && <p className="text-xs text-mist mt-1">{fu.notes}</p>}
                </div>
                {fu.status !== 'Completed' && (
                  <button onClick={() => handleCompleteFollowUp(fu.id)} className="btn-ghost text-xs px-3 py-1.5 shrink-0">
                    <CheckCircle2 size={12} /> Done
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trials */}
      {trials.length > 0 && (
        <div>
          <h3 className="section-title mb-3">Trial Status</h3>
          <div className="space-y-3">
            {trials.map(trial => (
              <div key={trial.id} className="glass p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span className="chip-gold text-xs mb-2 inline-block">{trial.trial_status}</span>
                    <p className="text-sm text-chalk">
                      {formatDate(trial.trial_start_date)} — {formatDate(trial.trial_end_date)}
                    </p>
                  </div>
                </div>
                {trial.features_included?.length > 0 && (
                  <div className="mt-3">
                    <p className="label">Features</p>
                    <ul className="space-y-1">
                      {trial.features_included.map((f, i) => (
                        <li key={i} className="text-xs text-chalk flex items-center gap-1.5">
                          <CheckCircle2 size={10} className="text-success" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {trial.notes && <p className="text-xs text-mist mt-2">{trial.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-Up Modal */}
      <Modal open={showFollowUpModal} onClose={() => setShowFollowUpModal(false)} title="Schedule Follow-Up">
        <div className="space-y-4">
          <div>
            <label className="label">Scheduled Date</label>
            <input type="date" value={fuDate} onChange={e => setFuDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Follow-Up Type</label>
            <select value={fuType} onChange={e => setFuType(e.target.value)}>
              <option>Email</option>
              <option>Phone Call</option>
              <option>LinkedIn</option>
              <option>Text</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={fuNotes} onChange={e => setFuNotes(e.target.value)} rows={3} placeholder="Add any notes…" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSaveFollowUp} className="btn-gold">Schedule</button>
            <button onClick={() => setShowFollowUpModal(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Trial Modal */}
      <Modal open={showTrialModal} onClose={() => setShowTrialModal(false)} title="Start 14-Day Trial" size="lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Trial Start Date</label>
              <input type="date" value={trialStart} onChange={e => { setTrialStart(e.target.value); setTrialEnd(addDays(e.target.value, 14)); }} />
            </div>
            <div>
              <label className="label">Trial End Date</label>
              <input type="date" value={trialEnd} onChange={e => setTrialEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Features Included</label>
            <div className="space-y-2">
              {TRIAL_FEATURES.map(f => (
                <label key={f} className="flex items-center gap-2 text-sm text-chalk cursor-pointer">
                  <input type="checkbox" checked={trialFeatures.includes(f)} onChange={() => toggleFeature(f)} className="w-4 h-4 accent-gold" />
                  {f}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Success Criteria</label>
            <div className="space-y-2">
              {TRIAL_SUCCESS_CRITERIA.map(c => (
                <label key={c} className="flex items-center gap-2 text-sm text-chalk cursor-pointer">
                  <input type="checkbox" checked={trialCriteria.includes(c)} onChange={() => toggleCriteria(c)} className="w-4 h-4 accent-gold" />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={trialNotes} onChange={e => setTrialNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSaveTrial} className="btn-gold">Offer Trial</button>
            <button onClick={() => setShowTrialModal(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Stage Modal */}
      <Modal open={showStageModal} onClose={() => setShowStageModal(false)} title="Move Stage" size="lg">
        <div className="grid grid-cols-2 gap-2">
          {CRM_STAGES.map(stage => (
            <button
              key={stage}
              onClick={() => handleMoveStage(stage)}
              className={`p-3 rounded-xl border text-sm font-medium text-left transition-all ${lead.crm_stage === stage ? 'border-gold/60 bg-gold/10 text-gold-light' : 'border-ink-line bg-ink-card/40 text-chalk hover:border-electric/40 hover:text-paper'}`}
            >
              {stage}
            </button>
          ))}
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Lead" size="sm">
        <p className="text-chalk text-sm mb-4">Are you sure you want to delete <strong className="text-paper">{lead.restaurant_name}</strong>? This will also delete all audits, email drafts, follow-ups, and trials for this lead.</p>
        <div className="flex gap-2">
          <button onClick={handleDelete} className="btn-ghost text-danger border-danger/40 hover:border-danger flex-1">Delete</button>
          <button onClick={() => setShowDeleteModal(false)} className="btn-ghost flex-1">Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
