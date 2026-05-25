import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, BarChart2, Mail, CheckCircle2, Send,
  Clock, Calendar, Trophy, DollarSign, ArrowRight, Zap,
  AlertTriangle, Star,
} from 'lucide-react';
import { leadsDB, auditsDB, emailDraftsDB, followupsDB, trialsDB } from '../lib/database';
import StatCard from '../components/StatCard';
import ScoreBadge from '../components/ScoreBadge';
import StageChip from '../components/StageChip';
import type { Lead, EmailDraft, FollowUp, Trial } from '../types';
import { formatCurrency, today } from '../utils/formatters';

export default function Dashboard() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);

  useEffect(() => {
    setLeads(leadsDB.getAll());
    setDrafts(emailDraftsDB.getAll());
    setFollowups(followupsDB.getAll());
    setTrials(trialsDB.getAll());
  }, []);

  const todayStr = today();
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.crm_stage === 'New Lead').length;
  const auditsCompleted = auditsDB.getAll().length;
  const emailsDrafted = drafts.filter(d => d.status === 'Draft').length;
  const emailsApproved = drafts.filter(d => d.status === 'Approved').length;
  const emailsSent = drafts.filter(d => d.status === 'Sent').length;
  const followupsDueToday = followups.filter(f => f.scheduled_date === todayStr && f.status !== 'Completed' && f.status !== 'Skipped').length;
  const activeTrials = trials.filter(t => t.trial_status === 'Active' || t.trial_status === 'Accepted').length;
  const closedWon = leads.filter(l => l.crm_stage === 'Closed Won').length;
  const estMonthlyRevenue = closedWon * 750;

  const highOpp = leads.filter(l => l.bottleneck_score >= 70).length;
  const medOpp = leads.filter(l => l.bottleneck_score >= 40 && l.bottleneck_score < 70).length;
  const lowOpp = leads.filter(l => l.bottleneck_score < 40).length;

  const needsResearch = leads.filter(l => l.crm_stage === 'New Lead').slice(0, 3);
  const needsEmail = leads.filter(l => l.bottleneck_score >= 70 && drafts.filter(d => d.lead_id === l.id).length === 0).slice(0, 3);
  const pendingApproval = drafts.filter(d => d.status === 'Draft').slice(0, 3);
  const dueFollowups = followups.filter(f => f.scheduled_date === todayStr && f.status !== 'Completed').slice(0, 3);
  const endingSoonTrials = trials.filter(t => {
    if (!t.trial_end_date || t.trial_status === 'Converted' || t.trial_status === 'Not Converted') return false;
    const diff = (new Date(t.trial_end_date).getTime() - Date.now()) / 86400000;
    return diff <= 3 && diff >= 0;
  }).slice(0, 3);

  const recentLeads = [...leads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const dateDisplay = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-32 pt-5 space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="eyebrow">Winners Bookmark Agency</p>
        <h1 className="display-title text-paper">Dashboard</h1>
        <p className="text-mist text-sm mt-1">{dateDisplay}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total Leads" value={totalLeads} icon={Users} color="blue" />
        <StatCard label="New Leads" value={newLeads} icon={UserPlus} color="blue" />
        <StatCard label="Audits Completed" value={auditsCompleted} icon={BarChart2} color="gold" />
        <StatCard label="Emails Drafted" value={emailsDrafted} icon={Mail} color="gold" />
        <StatCard label="Emails Approved" value={emailsApproved} icon={CheckCircle2} color="green" />
        <StatCard label="Emails Sent" value={emailsSent} icon={Send} color="green" />
        <StatCard label="Follow-Ups Due" value={followupsDueToday} icon={Clock} color="red" sub="Today" />
        <StatCard label="Active Trials" value={activeTrials} icon={Calendar} color="gold" />
        <StatCard label="Closed Clients" value={closedWon} icon={Trophy} color="green" />
        <StatCard label="Est. Monthly Rev." value={formatCurrency(estMonthlyRevenue)} icon={DollarSign} color="gold" sub={`${closedWon} clients × $750/mo`} />
      </div>

      {/* Today's Next Best Actions */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-lg bg-electric/10 flex items-center justify-center">
            <Zap size={14} className="text-electric" />
          </div>
          <h2 className="section-title">Today's Next Best Actions</h2>
        </div>

        {needsResearch.length === 0 && needsEmail.length === 0 && pendingApproval.length === 0 && dueFollowups.length === 0 && endingSoonTrials.length === 0 ? (
          <div className="glass p-6 text-center">
            <CheckCircle2 size={28} className="text-success mx-auto mb-2" />
            <p className="text-chalk font-semibold">All caught up!</p>
            <p className="text-mist text-sm mt-1">No urgent actions needed right now.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsResearch.map(lead => (
              <button key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}
                className="glass p-4 text-left hover:border-electric/40 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="label">Research Needed</p>
                    <p className="font-semibold text-paper text-sm truncate">{lead.restaurant_name}</p>
                    <p className="text-mist text-xs mt-1">{lead.city} · New Lead</p>
                  </div>
                  <ArrowRight size={14} className="text-electric mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </button>
            ))}
            {needsEmail.map(lead => (
              <button key={lead.id} onClick={() => navigate(`/emails/${lead.id}`)}
                className="glass p-4 text-left hover:border-gold/40 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="label" style={{ color: 'var(--color-gold)' }}>High Score — No Email</p>
                    <p className="font-semibold text-paper text-sm truncate">{lead.restaurant_name}</p>
                    <p className="text-mist text-xs mt-1">Score: {lead.bottleneck_score} · Generate draft</p>
                  </div>
                  <ArrowRight size={14} className="text-gold mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </button>
            ))}
            {pendingApproval.map(draft => {
              const lead = leads.find(l => l.id === draft.lead_id);
              return (
                <button key={draft.id} onClick={() => navigate(`/emails/${draft.lead_id}`)}
                  className="glass p-4 text-left hover:border-purple-400/40 transition-all group">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="label" style={{ color: '#c084fc' }}>Draft Awaiting Approval</p>
                      <p className="font-semibold text-paper text-sm truncate">{lead?.restaurant_name || 'Unknown'}</p>
                      <p className="text-mist text-xs mt-1">{draft.email_type}</p>
                    </div>
                    <ArrowRight size={14} className="text-purple-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </button>
              );
            })}
            {dueFollowups.map(fu => {
              const lead = leads.find(l => l.id === fu.lead_id);
              return (
                <button key={fu.id} onClick={() => navigate('/followups')}
                  className="glass p-4 text-left hover:border-danger/40 transition-all group border-danger/20">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="label" style={{ color: 'var(--color-danger)' }}>Follow-Up Due Today</p>
                      <p className="font-semibold text-paper text-sm truncate">{lead?.restaurant_name || 'Unknown'}</p>
                      <p className="text-mist text-xs mt-1">#{fu.followup_number} · {fu.followup_type}</p>
                    </div>
                    <AlertTriangle size={14} className="text-danger mt-1 shrink-0" />
                  </div>
                </button>
              );
            })}
            {endingSoonTrials.map(trial => {
              const lead = leads.find(l => l.id === trial.lead_id);
              const daysLeft = Math.ceil((new Date(trial.trial_end_date).getTime() - Date.now()) / 86400000);
              return (
                <button key={trial.id} onClick={() => navigate('/trials')}
                  className="glass p-4 text-left hover:border-gold/40 transition-all group border-gold/20">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="label">Trial Ending Soon</p>
                      <p className="font-semibold text-paper text-sm truncate">{lead?.restaurant_name || 'Unknown'}</p>
                      <p className="text-mist text-xs mt-1">{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</p>
                    </div>
                    <Calendar size={14} className="text-gold mt-1 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Opportunity Score Breakdown */}
      <section>
        <h2 className="section-title mb-4">Opportunity Score Breakdown</h2>
        <div className="glass p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-success">High Opportunity (70–100)</span>
              <span className="text-sm font-bold text-paper">{highOpp} leads</span>
            </div>
            <div className="h-2.5 rounded-full bg-ink-line overflow-hidden">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: totalLeads > 0 ? `${(highOpp / totalLeads) * 100}%` : '0%' }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gold-light">Medium Opportunity (40–69)</span>
              <span className="text-sm font-bold text-paper">{medOpp} leads</span>
            </div>
            <div className="h-2.5 rounded-full bg-ink-line overflow-hidden">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: totalLeads > 0 ? `${(medOpp / totalLeads) * 100}%` : '0%' }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-mist">Low Opportunity (0–39)</span>
              <span className="text-sm font-bold text-paper">{lowOpp} leads</span>
            </div>
            <div className="h-2.5 rounded-full bg-ink-line overflow-hidden">
              <div className="h-full rounded-full bg-ink-edge transition-all" style={{ width: totalLeads > 0 ? `${(lowOpp / totalLeads) * 100}%` : '0%' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Recent Leads */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Recent Leads</h2>
          <Link to="/leads" className="text-electric text-sm font-medium hover:text-electric-glow transition-colors flex items-center gap-1">
            View All <ArrowRight size={13} />
          </Link>
        </div>
        {recentLeads.length === 0 ? (
          <div className="glass p-8 text-center">
            <Users size={24} className="text-mist mx-auto mb-2" />
            <p className="text-chalk text-sm">No leads yet.</p>
            <Link to="/leads/new" className="btn-primary mt-4 text-sm px-4 py-2 inline-flex">Add First Lead</Link>
          </div>
        ) : (
          <div className="glass divide-y divide-ink-line overflow-hidden">
            {recentLeads.map(lead => (
              <div key={lead.id} className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-paper text-sm">{lead.restaurant_name}</span>
                    {lead.rating > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-gold-light">
                        <Star size={10} fill="currentColor" />{lead.rating}
                      </span>
                    )}
                  </div>
                  <p className="text-mist text-xs mt-0.5">{lead.city}{lead.cuisine ? ` · ${lead.cuisine}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ScoreBadge score={lead.bottleneck_score} size="sm" />
                  <StageChip stage={lead.crm_stage} />
                  <Link to={`/leads/${lead.id}`} className="icon-btn w-8 h-8 text-xs">
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
