import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { leadsDB } from '../lib/database';
import { useToast } from '../context/ToastContext';
import ScoreBadge from '../components/ScoreBadge';
import StageChip from '../components/StageChip';
import { CRM_STAGES } from '../types';
import type { Lead, CRMStage } from '../types';
import { truncate } from '../utils/formatters';
import { ChevronDown } from 'lucide-react';

const STAGE_COLORS: Record<string, string> = {
  'New Lead': 'border-electric/30',
  'Researched': 'border-gold/30',
  'Bottleneck Audit Created': 'border-gold/40',
  'Email Drafted': 'border-purple-500/30',
  'Email Approved': 'border-purple-500/40',
  'Email Sent': 'border-blue-400/30',
  'Follow-Up 1': 'border-orange-500/30',
  'Follow-Up 2': 'border-orange-500/40',
  'Discovery Call Booked': 'border-teal-500/30',
  'Proposal Sent': 'border-indigo-500/30',
  'Trial Offered': 'border-yellow-500/30',
  'Trial Started': 'border-yellow-500/40',
  'Closed Won': 'border-success/40',
  'Closed Lost': 'border-danger/30',
  'Do Not Contact': 'border-ink-edge',
};

function LeadKanbanCard({ lead, onMoveStage }: { lead: Lead; onMoveStage: (id: string, stage: CRMStage) => void }) {
  const [showMove, setShowMove] = useState(false);

  return (
    <div className={`bg-ink-card/80 border ${STAGE_COLORS[lead.crm_stage] || 'border-ink-line'} rounded-xl p-3 space-y-2`}>
      <Link to={`/leads/${lead.id}`} className="block font-semibold text-paper text-sm hover:text-gold-light transition-colors leading-snug">
        {lead.restaurant_name}
      </Link>
      <div className="text-[11px] text-mist">{lead.city}{lead.cuisine ? ` · ${lead.cuisine}` : ''}</div>
      {lead.bottleneck_score > 0 && <ScoreBadge score={lead.bottleneck_score} size="sm" />}
      {lead.main_bottleneck && (
        <p className="text-[11px] text-mist leading-snug">{truncate(lead.main_bottleneck, 70)}</p>
      )}
      {lead.recommended_offer && (
        <span className="chip-gold text-[10px]">{lead.recommended_offer}</span>
      )}

      <div className="relative">
        <button
          onClick={() => setShowMove(v => !v)}
          className="flex items-center gap-1.5 text-[11px] text-mist hover:text-paper transition-colors mt-1"
        >
          <ChevronDown size={12} /> Move Stage
        </button>
        {showMove && (
          <div className="absolute top-6 left-0 z-20 w-52 bg-ink-panel border border-ink-edge rounded-xl shadow-panel-lg py-1 max-h-64 overflow-y-auto">
            {CRM_STAGES.map(stage => (
              <button
                key={stage}
                onClick={() => { onMoveStage(lead.id, stage); setShowMove(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${lead.crm_stage === stage ? 'text-gold-light font-semibold bg-gold/5' : 'text-chalk hover:bg-ink-card hover:text-paper'}`}
              >
                {stage}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CRMPipeline() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => { setLeads(leadsDB.getAll()); }, []);

  function handleMoveStage(id: string, stage: CRMStage) {
    leadsDB.updateStage(id, stage);
    setLeads(leadsDB.getAll());
    toast(`Moved to ${stage}`, 'success');
  }

  const byStage = (stage: CRMStage) => leads.filter(l => l.crm_stage === stage);
  const total = leads.length;

  return (
    <div className="pb-16 fade-in">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">CRM</p>
          <h1 className="display-title text-paper">Pipeline</h1>
          <p className="text-mist text-sm mt-1">{total} total lead{total !== 1 ? 's' : ''} across all stages</p>
        </div>
        <Link to="/leads/new" className="btn-gold shrink-0">+ Add Lead</Link>
      </div>

      {/* Kanban board — horizontal scroll */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-3 pb-4" style={{ minWidth: `${CRM_STAGES.length * 220}px` }}>
          {CRM_STAGES.map(stage => {
            const stageLeads = byStage(stage);
            const isWon = stage === 'Closed Won';
            const isLost = stage === 'Closed Lost' || stage === 'Do Not Contact';
            return (
              <div
                key={stage}
                className={`flex-none w-52 rounded-xl border ${isWon ? 'border-success/30 bg-success/5' : isLost ? 'border-danger/15 bg-danger/5' : 'border-ink-line bg-ink-card/30'}`}
              >
                <div className="p-3 border-b border-ink-line/50">
                  <div className="flex items-center justify-between gap-2">
                    <StageChip stage={stage} />
                    <span className={`text-xs font-bold ${stageLeads.length > 0 ? 'text-paper' : 'text-ghost'}`}>
                      {stageLeads.length}
                    </span>
                  </div>
                </div>
                <div className="p-2 space-y-2 min-h-[80px]">
                  {stageLeads.length === 0 ? (
                    <p className="text-[11px] text-ghost text-center py-4">Empty</p>
                  ) : (
                    stageLeads.map(lead => (
                      <LeadKanbanCard key={lead.id} lead={lead} onMoveStage={handleMoveStage} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
