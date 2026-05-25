import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Mail, Zap, Copy, CheckCircle2, Send, Shield, AlertTriangle, Trash2 } from 'lucide-react';
import { emailDraftsDB, leadsDB, auditsDB, settingsDB } from '../lib/database';
import { generateEmailDraft, checkEmailCompliance, getAIProviderLabel } from '../services/aiService';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { EMAIL_TEMPLATES } from '../prompts/emailDraftPrompt';
import { formatRelative } from '../utils/formatters';
import type { Lead, Audit, EmailDraft, AppSettings } from '../types';

type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
const EMAIL_TYPES = Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[];

const STATUS_COLORS = {
  Draft: 'bg-ink-card border-ink-line text-mist',
  Approved: 'bg-gold/10 border-gold/30 text-gold-light',
  Sent: 'bg-success/10 border-success/30 text-success',
};

export default function EmailDrafts() {
  const { leadId: urlLeadId } = useParams<{ leadId: string }>();
  const { toast } = useToast();

  // Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [settings, setSettings] = useState<AppSettings>(settingsDB.get());

  // Generator state
  const [selectedLeadId, setSelectedLeadId] = useState(urlLeadId || '');
  const [emailType, setEmailType] = useState<EmailTemplateKey>('Free Bottleneck Audit Offer');
  const [generating, setGenerating] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Filter
  const [filterLeadId, setFilterLeadId] = useState(urlLeadId || '');

  function reload() {
    setLeads(leadsDB.getAll().filter(l => !!l.email));
    setDrafts(emailDraftsDB.getAll().sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setSettings(settingsDB.get());
  }

  useEffect(() => {
    reload();
    if (urlLeadId) {
      setSelectedLeadId(urlLeadId);
      setFilterLeadId(urlLeadId);
    }
  }, [urlLeadId]);

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  const filteredDrafts = filterLeadId
    ? drafts.filter(d => d.lead_id === filterLeadId)
    : drafts;

  // Compliance check
  const complianceResult = subject || body
    ? checkEmailCompliance(
        { subject, body, approved_by_user: false },
        {
          opt_out: selectedLead?.opt_out || false,
          crm_stage: selectedLead?.crm_stage || 'New Lead',
          email: selectedLead?.email || '',
        },
        settings
      )
    : null;

  async function handleGenerate() {
    if (!selectedLeadId) { toast('Select a lead first', 'warning'); return; }
    setGenerating(true);
    setSaved(false);
    setCurrentDraftId(null);
    try {
      const lead = leadsDB.getById(selectedLeadId)!;
      const latestAudit = auditsDB.getLatestByLead(selectedLeadId);
      const result = await generateEmailDraft(emailType, lead, latestAudit || null, settings);
      setSubject(result.subject);
      setBody(result.body);
      toast('Draft generated', 'success');
    } catch (err) {
      toast('Generation failed — check console', 'error');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  function handleSave() {
    if (!subject.trim() || !body.trim() || !selectedLeadId) {
      toast('Subject, body, and lead are required', 'warning');
      return;
    }
    if (currentDraftId) {
      emailDraftsDB.update(currentDraftId, { subject, body });
      toast('Draft updated', 'success');
    } else {
      const draft = emailDraftsDB.create({
        lead_id: selectedLeadId,
        subject,
        body,
        email_type: emailType,
        status: 'Draft',
        approved_by_user: false,
        sent_at: '',
      });
      setCurrentDraftId(draft.id);
      const lead = leadsDB.getById(selectedLeadId);
      if (lead && lead.crm_stage === 'New Lead' || lead?.crm_stage === 'Researched' || lead?.crm_stage === 'Bottleneck Audit Created') {
        leadsDB.updateStage(selectedLeadId, 'Email Drafted');
      }
      toast('Draft saved', 'success');
    }
    setSaved(true);
    reload();
  }

  function handleApprove() {
    if (!currentDraftId) { toast('Save the draft first', 'warning'); return; }
    if (!complianceResult?.passed) {
      toast('Fix compliance issues before approving', 'error');
      return;
    }
    emailDraftsDB.approve(currentDraftId);
    leadsDB.updateStage(selectedLeadId, 'Email Approved');
    reload();
    toast('Draft approved ✓', 'success');
  }

  function handleCopy() {
    const text = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard', 'success'));
  }

  function handleMarkSent(id: string) {
    emailDraftsDB.markSent(id);
    const draft = emailDraftsDB.getById(id);
    if (draft) leadsDB.updateStage(draft.lead_id, 'Email Sent');
    if (id === currentDraftId) setSaved(false);
    reload();
    toast('Email marked as sent', 'success');
  }

  function handleDelete(id: string) {
    emailDraftsDB.delete(id);
    if (id === currentDraftId) {
      setCurrentDraftId(null);
      setSubject('');
      setBody('');
      setSaved(false);
    }
    reload();
    toast('Draft deleted', 'info');
  }

  function loadDraft(draft: EmailDraft) {
    setSelectedLeadId(draft.lead_id);
    setEmailType(draft.email_type as EmailTemplateKey || 'Free Bottleneck Audit Offer');
    setSubject(draft.subject);
    setBody(draft.body);
    setCurrentDraftId(draft.id);
    setSaved(true);
  }

  const currentDraft = drafts.find(d => d.id === currentDraftId);

  return (
    <div className="pb-16 fade-in">
      <div className="mb-6">
        <p className="eyebrow">Outreach</p>
        <h1 className="display-title text-paper">Email Drafts</h1>
        <p className="text-mist text-sm mt-1">Generate, review, and approve outreach emails. Never sent automatically.</p>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-6">

        {/* Left: Drafts list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">Saved Drafts</h2>
            <select
              value={filterLeadId}
              onChange={e => setFilterLeadId(e.target.value)}
              className="text-xs py-1.5"
            >
              <option value="">All Leads</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.restaurant_name}</option>)}
            </select>
          </div>

          {filteredDrafts.length === 0 ? (
            <EmptyState icon={Mail} title="No drafts yet" description="Generate your first email draft using the panel →" />
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1 scrollbar-hide">
              {filteredDrafts.map(draft => {
                const lead = leads.find(l => l.id === draft.lead_id) || leadsDB.getById(draft.lead_id);
                return (
                  <button
                    key={draft.id}
                    onClick={() => loadDraft(draft)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${draft.id === currentDraftId ? 'border-gold/40 bg-gold/5' : 'border-ink-line bg-ink-card/40 hover:border-electric/30'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-paper truncate">{lead?.restaurant_name || 'Unknown'}</p>
                        <p className="text-[11px] text-mist truncate mt-0.5">{draft.email_type}</p>
                        <p className="text-[11px] text-chalk/70 truncate mt-0.5">{draft.subject}</p>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[draft.status]}`}>
                          {draft.status}
                        </span>
                        <p className="text-[10px] text-ghost">{formatRelative(draft.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
                      {draft.status === 'Approved' && (
                        <button
                          onClick={() => handleMarkSent(draft.id)}
                          className="text-[10px] text-success border border-success/30 rounded-lg px-2 py-0.5 hover:bg-success/10 transition-colors"
                        >
                          Mark Sent
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(draft.id)}
                        className="text-[10px] text-danger/70 border border-danger/20 rounded-lg px-2 py-0.5 hover:bg-danger/10 transition-colors ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Generator */}
        <div className="space-y-5">
          {/* Generator controls */}
          <div className="glass p-5 space-y-4">
            <h2 className="section-title flex items-center gap-2">
              <Zap size={16} className="text-gold" /> Draft Generator
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Lead (with email) *</label>
                <select value={selectedLeadId} onChange={e => { setSelectedLeadId(e.target.value); setSaved(false); setCurrentDraftId(null); }}>
                  <option value="">— Select lead —</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.restaurant_name} · {l.city}</option>)}
                </select>
                {leads.length === 0 && (
                  <p className="text-xs text-gold mt-1">Add leads with email addresses first.</p>
                )}
              </div>
              <div>
                <label className="label">Email Type *</label>
                <select value={emailType} onChange={e => { setEmailType(e.target.value as EmailTemplateKey); setSaved(false); }}>
                  {EMAIL_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <p className="text-[11px] text-mist mt-1">{EMAIL_TEMPLATES[emailType]?.description}</p>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedLeadId}
              className="btn-gold w-full justify-center disabled:opacity-50"
            >
              {generating ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Generating…
                </>
              ) : (
                <><Zap size={15} /> Generate Draft ({getAIProviderLabel()})</>
              )}
            </button>
          </div>

          {/* Email editor */}
          {(subject || body) && (
            <div className="glass p-5 space-y-4 slide-up">
              <div className="flex items-center justify-between gap-3">
                <h3 className="section-title">Email Draft</h3>
                {currentDraft && (
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[currentDraft.status]}`}>
                    {currentDraft.status}
                  </span>
                )}
              </div>

              <div>
                <label className="label">Subject Line</label>
                <input type="text" value={subject} onChange={e => { setSubject(e.target.value); setSaved(false); }} />
              </div>
              <div>
                <label className="label">Email Body</label>
                <textarea
                  value={body}
                  onChange={e => { setBody(e.target.value); setSaved(false); }}
                  rows={16}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Compliance */}
              {complianceResult && (
                <div className={`p-3.5 rounded-xl border ${complianceResult.passed ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className={complianceResult.passed ? 'text-success' : 'text-danger'} />
                    <p className={`text-sm font-semibold ${complianceResult.passed ? 'text-success' : 'text-danger'}`}>
                      {complianceResult.passed ? 'Compliance check passed' : `${complianceResult.issues.length} compliance issue(s)`}
                    </p>
                  </div>
                  {complianceResult.issues.length > 0 && (
                    <ul className="space-y-1">
                      {complianceResult.issues.map((issue, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-danger">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={handleSave} className="btn-ghost text-sm">
                  <Mail size={14} /> {saved ? 'Update Draft' : 'Save Draft'}
                </button>
                <button onClick={handleCopy} className="btn-ghost text-sm">
                  <Copy size={14} /> Copy Email
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!saved || !complianceResult?.passed || currentDraft?.status === 'Approved' || currentDraft?.status === 'Sent'}
                  className="btn-gold text-sm disabled:opacity-50"
                  title={!complianceResult?.passed ? 'Fix compliance issues first' : !saved ? 'Save draft first' : ''}
                >
                  <CheckCircle2 size={14} />
                  {currentDraft?.status === 'Approved' ? 'Approved ✓' : currentDraft?.status === 'Sent' ? 'Sent' : 'Approve Draft'}
                </button>
                {currentDraft?.status === 'Approved' && (
                  <button onClick={() => handleMarkSent(currentDraft.id)} className="btn-ghost text-sm text-success border-success/30">
                    <Send size={14} /> Mark as Sent
                  </button>
                )}
              </div>

              {!settings.business_address && (
                <div className="text-xs text-gold flex items-center gap-1.5 mt-1">
                  <AlertTriangle size={12} />
                  Business mailing address missing.{' '}
                  <Link to="/settings" className="underline hover:text-gold-light">Go to Settings →</Link>
                </div>
              )}

              <p className="text-[11px] text-ghost border-t border-ink-line pt-3">
                ⚠ This email requires human approval and is never sent automatically. Copy and send manually from your email client.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
