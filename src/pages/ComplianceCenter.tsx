import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, ShieldCheck, AlertTriangle, Ban } from 'lucide-react';
import { leadsDB, emailDraftsDB, settingsDB } from '../lib/database';
import { checkEmailCompliance } from '../services/aiService';
import { formatDate } from '../utils/formatters';
import type { Lead, EmailDraft, AppSettings } from '../types';

interface RuleResult {
  label: string;
  passed: boolean;
  detail?: string;
}

export default function ComplianceCenter() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [settings, setSettings] = useState<AppSettings>(settingsDB.get());

  useEffect(() => {
    setLeads(leadsDB.getAll());
    setDrafts(emailDraftsDB.getAll());
    setSettings(settingsDB.get());
  }, []);

  const dncLeads = leads.filter(l => l.opt_out || l.crm_stage === 'Do Not Contact');
  const approvedDrafts = drafts.filter(d => d.status === 'Approved' || d.status === 'Sent');

  const approvedWithoutOptOut = approvedDrafts.filter(d => {
    const body = d.body?.toLowerCase() || '';
    return !body.includes('opt out') && !body.includes('unsubscribe') && !body.includes('remove you from my list');
  });

  const sentToDNC = drafts.filter(d => {
    if (d.status !== 'Sent') return false;
    const lead = leads.find(l => l.id === d.lead_id);
    return lead?.opt_out || lead?.crm_stage === 'Do Not Contact';
  });

  const rules: RuleResult[] = [
    {
      label: 'Business mailing address saved in Settings',
      passed: !!settings.business_address?.trim(),
      detail: settings.business_address ? settings.business_address : 'Go to Settings → Business Mailing Address',
    },
    {
      label: 'Founder name configured',
      passed: !!settings.founder_name?.trim(),
      detail: settings.founder_name || 'Go to Settings → Founder Name',
    },
    {
      label: 'Company name configured',
      passed: !!settings.company_name?.trim(),
      detail: settings.company_name || 'Go to Settings → Company Name',
    },
    {
      label: 'Compliance footer / opt-out line configured',
      passed: !!settings.compliance_footer?.trim(),
      detail: 'Required in every outreach email',
    },
    {
      label: 'All approved emails have opt-out lines',
      passed: approvedWithoutOptOut.length === 0,
      detail: approvedWithoutOptOut.length > 0
        ? `${approvedWithoutOptOut.length} approved email(s) missing opt-out line`
        : `${approvedDrafts.length} approved email(s) checked — all pass`,
    },
    {
      label: 'No emails sent to Do Not Contact leads',
      passed: sentToDNC.length === 0,
      detail: sentToDNC.length > 0
        ? `${sentToDNC.length} email(s) sent to DNC leads — review immediately`
        : 'Clean — no violations found',
    },
    {
      label: 'No Do Not Contact leads in active outreach',
      passed: dncLeads.length === 0 || dncLeads.every(l => l.crm_stage === 'Do Not Contact'),
      detail: `${dncLeads.length} lead(s) marked DNC — they will not receive emails`,
    },
  ];

  const passed = rules.filter(r => r.passed).length;
  const total = rules.length;
  const score = Math.round((passed / total) * 100);

  return (
    <div className="max-w-3xl mx-auto pb-16 fade-in">
      <div className="mb-6">
        <p className="eyebrow">Legal &amp; Safety</p>
        <h1 className="display-title text-paper">Compliance Center</h1>
        <p className="text-mist text-sm mt-1">Ensure all outreach meets legal and ethical standards before sending.</p>
      </div>

      {/* Score */}
      <div className="glass p-5 mb-6 flex items-center gap-5">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${
          score === 100 ? 'bg-success/15 text-success' : score >= 70 ? 'bg-gold/15 text-gold-light' : 'bg-danger/15 text-danger'
        }`}>
          {score}%
        </div>
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className={score === 100 ? 'text-success' : 'text-gold'} />
            <p className="font-bold text-paper">Compliance Score</p>
          </div>
          <p className="text-sm text-mist mt-0.5">{passed} of {total} rules passing</p>
          {score < 100 && (
            <p className="text-xs text-gold mt-1 flex items-center gap-1">
              <AlertTriangle size={12} /> Action required before approving emails
            </p>
          )}
        </div>
      </div>

      {/* Rules Checklist */}
      <div className="glass p-5 mb-6 space-y-3">
        <h2 className="section-title">Email Safety Checklist</h2>
        <div className="space-y-2.5">
          {rules.map((rule, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
              rule.passed ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'
            }`}>
              {rule.passed
                ? <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
                : <XCircle size={16} className="text-danger mt-0.5 shrink-0" />
              }
              <div className="min-w-0">
                <p className={`text-sm font-medium ${rule.passed ? 'text-paper' : 'text-danger'}`}>{rule.label}</p>
                {rule.detail && <p className="text-xs text-mist mt-0.5">{rule.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DNC List */}
      <div className="glass p-5 mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <Ban size={18} className="text-danger" />
          <h2 className="section-title">Do Not Contact List</h2>
          <span className="chip text-xs">{dncLeads.length}</span>
        </div>
        {dncLeads.length === 0 ? (
          <p className="text-mist text-sm">No leads marked as Do Not Contact.</p>
        ) : (
          <div className="space-y-2">
            {dncLeads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between gap-3 p-3 bg-danger/5 border border-danger/15 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-paper">{lead.restaurant_name}</p>
                  <p className="text-xs text-mist">{lead.email || 'No email'} · {lead.city}</p>
                  {lead.opt_out && <span className="text-[11px] text-danger">Opted out</span>}
                </div>
                <Link to={`/leads/${lead.id}`} className="btn-ghost text-xs px-3 py-1.5">View</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance Rules Info */}
      <div className="glass p-5 space-y-3">
        <h2 className="section-title">Compliance Rules</h2>
        <div className="space-y-2 text-sm text-mist leading-relaxed">
          {[
            'All outreach emails must include a truthful subject line.',
            'Every email must include a clear opt-out mechanism (reply "opt out").',
            'Every email must include the business mailing address.',
            'Never send emails to leads marked Do Not Contact.',
            'Never send emails to leads who have opted out.',
            'Emails must not contain false claims or misleading statements.',
            'Emails must be respectful and professional in tone.',
            'All emails require human review and approval before sending.',
            'Emails must never be sent automatically — only manually by the founder.',
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-gold/60 mt-0.5 shrink-0" />
              <p>{rule}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-10">
        <p className="text-[11px] text-ghost">Designed by Winnersbookmark Incorporated</p>
      </div>
    </div>
  );
}
