import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Zap, Save, BarChart2, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { leadsDB, auditsDB } from '../lib/database';
import { generateAudit, getAIProviderLabel, isAIConfigured } from '../services/aiService';
import { useToast } from '../context/ToastContext';
import { PageLoading } from '../components/LoadingSpinner';
import ScoreBadge from '../components/ScoreBadge';
import { getScoreLabel, scoreBarColor } from '../utils/scoring';
import { clamp } from '../utils/scoring';
import type { Lead, AuditResult } from '../types';

type Tab = 'ai' | 'manual';

const FRICTION_CHECKS = [
  'Phone often goes unanswered during busy hours',
  'Long wait times reported by guests',
  'Slow replies to guest questions online',
  'Reservation booking is difficult or confusing',
  'Online ordering causes guest confusion',
  'Staff overwhelmed during peak hours',
  'Inconsistent guest experience reported',
];

const REVENUE_CHECKS = [
  'Online ordering available',
  'Reservation system available',
  'Catering / event inquiry form available',
  'Private party booking page available',
  'Email capture / newsletter signup',
  'Loyalty / rewards program',
  'Specials or event promotion system',
  'Review request system',
];

const AI_OPP_CHECKS = [
  'FAQ chatbot would help answer guest questions',
  'Missed-call text-back would capture lost inquiries',
  'Reservation capture assistant needed',
  'Catering / private party AI inquiry capture needed',
  'Online ordering assistant would reduce confusion',
  'Review response assistant needed',
  'Email / DM triage system needed',
  'Weekly guest insight report would be valuable',
];

const DIGITAL_CHECKS = [
  'Website found and accessible',
  'Menu easy to find on website',
  'Phone number visible on website',
  'Address visible on website',
  'Online ordering available on website',
  'Reservation booking available on website',
  'Catering / private party info visible',
  'Contact form available',
];

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-chalk font-medium">{label}</span>
        <span className={`font-bold ${score >= 70 ? 'text-success' : score >= 40 ? 'text-gold' : 'text-danger'}`}>{score}</span>
      </div>
      <div className="h-2 bg-ink-line rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${scoreBarColor(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function BottleneckAudit() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('ai');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState(leadId || '');
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AuditResult | null>(null);

  // Manual audit state
  const [digital, setDigital] = useState(60);
  const [friction, setFriction] = useState(50);
  const [revenue, setRevenue] = useState(45);
  const [aiOpp, setAiOpp] = useState(65);
  const [manualBottlenecks, setManualBottlenecks] = useState(['', '', '']);
  const [recommendedSolution, setRecommendedSolution] = useState('');
  const [outreachAngle, setOutreachAngle] = useState('');
  const [nextAction, setNextAction] = useState('');

  // Checkbox states
  const [digitalChecks, setDigitalChecks] = useState<boolean[]>(new Array(DIGITAL_CHECKS.length).fill(false));
  const [frictionChecks, setFrictionChecks] = useState<boolean[]>(new Array(FRICTION_CHECKS.length).fill(false));
  const [revenueChecks, setRevenueChecks] = useState<boolean[]>(new Array(REVENUE_CHECKS.length).fill(false));
  const [aiOppChecks, setAiOppChecks] = useState<boolean[]>(new Array(AI_OPP_CHECKS.length).fill(false));

  useEffect(() => {
    const all = leadsDB.getAll().filter(l => !l.opt_out && l.crm_stage !== 'Do Not Contact');
    setLeads(all);
    if (leadId) setSelectedLeadId(leadId);
  }, [leadId]);

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Auto-score from checkboxes
  useEffect(() => {
    const dScore = clamp(Math.round((digitalChecks.filter(Boolean).length / DIGITAL_CHECKS.length) * 100));
    const fScore = clamp(Math.round((frictionChecks.filter(Boolean).length / FRICTION_CHECKS.length) * 100));
    const rScore = clamp(Math.round((revenueChecks.filter(Boolean).length / REVENUE_CHECKS.length) * 100));
    const aScore = clamp(Math.round((aiOppChecks.filter(Boolean).length / AI_OPP_CHECKS.length) * 100));
    setDigital(dScore || 10);
    setFriction(fScore || 10);
    setRevenue(rScore || 10);
    setAiOpp(aScore || 10);
  }, [digitalChecks, frictionChecks, revenueChecks, aiOppChecks]);

  const manualTotalScore = Math.round((digital + friction + revenue + aiOpp) / 4);

  async function handleGenerateAI() {
    if (!selectedLead) { toast('Select a lead first', 'warning'); return; }
    setLoading(true);
    setAiResult(null);
    try {
      const result = await generateAudit(selectedLead);
      setAiResult(result);
      toast('Audit generated', 'success');
    } catch (err) {
      toast('AI generation failed — check console', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function saveAIAudit() {
    if (!aiResult || !selectedLead) return;
    const audit = auditsDB.create({
      lead_id: selectedLead.id,
      digital_presence_score: aiResult.digital_presence_score,
      customer_friction_score: aiResult.customer_friction_score,
      revenue_capture_score: aiResult.revenue_capture_score,
      ai_opportunity_score: aiResult.ai_opportunity_score,
      bottleneck_score: aiResult.bottleneck_score,
      score_label: aiResult.score_label,
      audit_summary: aiResult.audit_summary,
      top_bottlenecks: aiResult.top_bottlenecks,
      recommended_solution: aiResult.recommended_ai_solution,
      estimated_revenue_leak: aiResult.main_revenue_leak,
      outreach_angle: aiResult.suggested_outreach_angle,
      confidence_level: aiResult.confidence_level,
      missing_information: aiResult.missing_information,
      next_best_action: aiResult.next_best_action,
    });
    leadsDB.updateScore(selectedLead.id, aiResult.bottleneck_score, aiResult.score_label, aiResult.top_bottlenecks, aiResult.top_bottlenecks[0] || '');
    leadsDB.updateStage(selectedLead.id, 'Bottleneck Audit Created');
    toast('Audit saved — lead score updated', 'success');
    navigate(`/leads/${selectedLead.id}`);
  }

  function saveManualAudit() {
    if (!selectedLead) { toast('Select a lead first', 'warning'); return; }
    const filteredBottlenecks = manualBottlenecks.filter(b => b.trim());
    const label = getScoreLabel(manualTotalScore);
    auditsDB.create({
      lead_id: selectedLead.id,
      digital_presence_score: digital,
      customer_friction_score: friction,
      revenue_capture_score: revenue,
      ai_opportunity_score: aiOpp,
      bottleneck_score: manualTotalScore,
      score_label: label,
      audit_summary: `Manual audit for ${selectedLead.restaurant_name}. Score: ${manualTotalScore}/100 (${label}).`,
      top_bottlenecks: filteredBottlenecks,
      recommended_solution: recommendedSolution,
      estimated_revenue_leak: filteredBottlenecks[0] || '',
      outreach_angle: outreachAngle,
      confidence_level: 'Medium',
      missing_information: [],
      next_best_action: nextAction,
    });
    leadsDB.updateScore(selectedLead.id, manualTotalScore, label, filteredBottlenecks, filteredBottlenecks[0] || '');
    leadsDB.updateStage(selectedLead.id, 'Bottleneck Audit Created');
    toast('Manual audit saved', 'success');
    navigate(`/leads/${selectedLead.id}`);
  }

  return (
    <div className="max-w-4xl mx-auto pb-16 fade-in">
      <div className="mb-6">
        <p className="eyebrow">Analysis</p>
        <h1 className="display-title text-paper">Bottleneck Audit</h1>
        <p className="text-mist text-sm mt-1">Score a restaurant's AI opportunity and identify revenue leaks.</p>
      </div>

      {/* Lead Selector */}
      <div className="glass p-5 mb-6">
        <label className="label">Select Lead to Audit</label>
        <select
          value={selectedLeadId}
          onChange={e => { setSelectedLeadId(e.target.value); setAiResult(null); }}
          className="max-w-md"
        >
          <option value="">— Choose a restaurant —</option>
          {leads.map(l => (
            <option key={l.id} value={l.id}>{l.restaurant_name} · {l.city}</option>
          ))}
        </select>
        {selectedLead && (
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-mist">
            <span>{selectedLead.cuisine || 'Unknown cuisine'}</span>
            {selectedLead.rating > 0 && <span>★ {selectedLead.rating} ({selectedLead.review_count} reviews)</span>}
            <span>Stage: <span className="text-chalk">{selectedLead.crm_stage}</span></span>
            {selectedLead.bottleneck_score > 0 && (
              <span>Last score: <span className="text-gold">{selectedLead.bottleneck_score}</span></span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-card/60 rounded-xl border border-ink-line mb-6 w-fit">
        {(['ai', 'manual'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-gold text-ink-black shadow' : 'text-mist hover:text-paper'}`}
          >
            {t === 'ai' ? `⚡ AI Audit (${getAIProviderLabel()})` : '✏️ Manual Audit'}
          </button>
        ))}
      </div>

      {/* ─── AI TAB ─────────────────────────────────────────────────────── */}
      {tab === 'ai' && (
        <div className="space-y-5">
          {!isAIConfigured() && (
            <div className="flex items-start gap-3 p-4 bg-gold/5 border border-gold/20 rounded-xl text-sm">
              <AlertCircle size={16} className="text-gold mt-0.5 shrink-0" />
              <p className="text-chalk">Running in <strong className="text-gold">Demo Mode</strong> — realistic mock data will be generated. Add <code className="text-paper bg-ink-card px-1 rounded">VITE_GEMINI_API_KEY</code> to .env for live AI.</p>
            </div>
          )}

          <button
            onClick={handleGenerateAI}
            disabled={loading || !selectedLeadId}
            className="btn-gold w-full justify-center py-4 text-base disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Generating Audit…
              </>
            ) : (
              <><Zap size={18} /> Generate AI Audit</>
            )}
          </button>

          {aiResult && (
            <div className="space-y-5 slide-up">
              {/* Score summary */}
              <div className="glass p-5">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <p className="eyebrow">Overall Score</p>
                    <ScoreBadge score={aiResult.bottleneck_score} size="lg" showBar />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-mist">Recommended Tier</p>
                    <p className="text-gold font-bold">{aiResult.recommended_pricing_tier}</p>
                    <p className="text-xs text-mist mt-0.5">Confidence: {aiResult.confidence_level}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <ScoreBar label="Digital Presence" score={aiResult.digital_presence_score} />
                  <ScoreBar label="Customer Friction" score={aiResult.customer_friction_score} />
                  <ScoreBar label="Revenue Capture" score={aiResult.revenue_capture_score} />
                  <ScoreBar label="AI Opportunity" score={aiResult.ai_opportunity_score} />
                </div>
              </div>

              {/* Top Bottlenecks */}
              <div className="glass p-5 space-y-3">
                <h3 className="section-title">Top Bottlenecks</h3>
                {aiResult.top_bottlenecks.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 bg-danger/5 border border-danger/15 rounded-xl">
                    <span className="text-danger font-bold text-sm w-5 shrink-0">{i + 1}.</span>
                    <p className="text-sm text-chalk">{b}</p>
                  </div>
                ))}
              </div>

              {/* Audit Details */}
              <div className="glass p-5 space-y-4">
                <h3 className="section-title">Audit Summary</h3>
                <p className="text-sm text-chalk leading-relaxed">{aiResult.audit_summary}</p>

                <div className="divider" />
                <div className="space-y-3">
                  <div>
                    <p className="label">Recommended AI Solution</p>
                    <p className="text-sm text-chalk">{aiResult.recommended_ai_solution}</p>
                  </div>
                  <div>
                    <p className="label">Suggested Outreach Angle</p>
                    <p className="text-sm text-chalk">{aiResult.suggested_outreach_angle}</p>
                  </div>
                  <div>
                    <p className="label">Main Revenue Leak</p>
                    <p className="text-sm text-chalk">{aiResult.main_revenue_leak}</p>
                  </div>
                  <div>
                    <p className="label">Next Best Action</p>
                    <p className="text-sm text-gold">{aiResult.next_best_action}</p>
                  </div>
                </div>

                {aiResult.missing_information.length > 0 && (
                  <>
                    <div className="divider" />
                    <div>
                      <p className="label">Missing Information</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {aiResult.missing_information.map(m => (
                          <span key={m} className="chip">{m}</span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button onClick={saveAIAudit} className="btn-gold w-full justify-center">
                <Save size={16} /> Save Audit &amp; Update Lead Score
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── MANUAL TAB ─────────────────────────────────────────────────── */}
      {tab === 'manual' && (
        <div className="space-y-5">
          {/* Score Summary */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Overall Score</h3>
              <ScoreBadge score={manualTotalScore} size="lg" />
            </div>
            <div className="space-y-3">
              <ScoreBar label="Digital Presence" score={digital} />
              <ScoreBar label="Customer Friction" score={friction} />
              <ScoreBar label="Revenue Capture" score={revenue} />
              <ScoreBar label="AI Opportunity" score={aiOpp} />
            </div>
            <p className="text-xs text-mist mt-3">Scores auto-calculate from checkboxes below.</p>
          </div>

          {/* Digital Presence */}
          <div className="glass p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Digital Presence</h3>
              <span className={`font-bold ${digital >= 70 ? 'text-success' : digital >= 40 ? 'text-gold' : 'text-danger'}`}>{digital}/100</span>
            </div>
            <p className="text-xs text-mist">Check items that are TRUE for this restaurant.</p>
            <div className="space-y-2">
              {DIGITAL_CHECKS.map((check, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={digitalChecks[i]}
                    onChange={e => {
                      const next = [...digitalChecks];
                      next[i] = e.target.checked;
                      setDigitalChecks(next);
                    }}
                    className="w-4 h-4 rounded border-ink-line bg-ink-card2 text-gold focus:ring-gold/30"
                  />
                  <span className="text-sm text-chalk group-hover:text-paper transition-colors">{check}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Customer Friction */}
          <div className="glass p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Customer Friction</h3>
              <span className={`font-bold ${friction >= 70 ? 'text-success' : friction >= 40 ? 'text-gold' : 'text-danger'}`}>{friction}/100</span>
            </div>
            <p className="text-xs text-mist">Check friction points observed or suspected.</p>
            <div className="space-y-2">
              {FRICTION_CHECKS.map((check, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={frictionChecks[i]}
                    onChange={e => {
                      const next = [...frictionChecks];
                      next[i] = e.target.checked;
                      setFrictionChecks(next);
                    }}
                    className="w-4 h-4 rounded border-ink-line bg-ink-card2 text-gold focus:ring-gold/30"
                  />
                  <span className="text-sm text-chalk group-hover:text-paper transition-colors">{check}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Revenue Capture */}
          <div className="glass p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Revenue Capture</h3>
              <span className={`font-bold ${revenue >= 70 ? 'text-success' : revenue >= 40 ? 'text-gold' : 'text-danger'}`}>{revenue}/100</span>
            </div>
            <p className="text-xs text-mist">Check revenue systems the restaurant already has.</p>
            <div className="space-y-2">
              {REVENUE_CHECKS.map((check, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={revenueChecks[i]}
                    onChange={e => {
                      const next = [...revenueChecks];
                      next[i] = e.target.checked;
                      setRevenueChecks(next);
                    }}
                    className="w-4 h-4 rounded border-ink-line bg-ink-card2 text-gold focus:ring-gold/30"
                  />
                  <span className="text-sm text-chalk group-hover:text-paper transition-colors">{check}</span>
                </label>
              ))}
            </div>
          </div>

          {/* AI Opportunity */}
          <div className="glass p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title">AI Opportunity</h3>
              <span className={`font-bold ${aiOpp >= 70 ? 'text-success' : aiOpp >= 40 ? 'text-gold' : 'text-danger'}`}>{aiOpp}/100</span>
            </div>
            <p className="text-xs text-mist">Check AI systems that would benefit this restaurant.</p>
            <div className="space-y-2">
              {AI_OPP_CHECKS.map((check, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={aiOppChecks[i]}
                    onChange={e => {
                      const next = [...aiOppChecks];
                      next[i] = e.target.checked;
                      setAiOppChecks(next);
                    }}
                    className="w-4 h-4 rounded border-ink-line bg-ink-card2 text-gold focus:ring-gold/30"
                  />
                  <span className="text-sm text-chalk group-hover:text-paper transition-colors">{check}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Manual Notes */}
          <div className="glass p-5 space-y-4">
            <h3 className="section-title">Audit Notes</h3>
            {[0, 1, 2].map(i => (
              <div key={i}>
                <label className="label">Bottleneck #{i + 1}</label>
                <input
                  type="text"
                  value={manualBottlenecks[i]}
                  onChange={e => {
                    const next = [...manualBottlenecks];
                    next[i] = e.target.value;
                    setManualBottlenecks(next);
                  }}
                  placeholder={`Describe bottleneck ${i + 1}…`}
                />
              </div>
            ))}
            <div>
              <label className="label">Recommended AI Solution</label>
              <textarea value={recommendedSolution} onChange={e => setRecommendedSolution(e.target.value)} rows={2} placeholder="What AI solution would help most?" />
            </div>
            <div>
              <label className="label">Suggested Outreach Angle</label>
              <textarea value={outreachAngle} onChange={e => setOutreachAngle(e.target.value)} rows={2} placeholder="How should we frame the outreach email?" />
            </div>
            <div>
              <label className="label">Next Best Action</label>
              <input type="text" value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="e.g. Send free bottleneck audit offer email" />
            </div>
          </div>

          <button onClick={saveManualAudit} disabled={!selectedLeadId} className="btn-gold w-full justify-center disabled:opacity-50">
            <Save size={16} /> Save Manual Audit &amp; Update Lead Score
          </button>
        </div>
      )}
    </div>
  );
}
