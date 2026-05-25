import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Filter, ChevronUp, ChevronDown, Star, X,
  Eye, Zap, Mail, UserPlus, SlidersHorizontal,
} from 'lucide-react';
import { leadsDB } from '../lib/database';
import ScoreBadge from '../components/ScoreBadge';
import StageChip from '../components/StageChip';
import EmptyState from '../components/EmptyState';
import { formatPhone, formatDate } from '../utils/formatters';
import type { Lead, CRMStage } from '../types';
import { CRM_STAGES } from '../types';

type SortField = 'restaurant_name' | 'city' | 'cuisine' | 'bottleneck_score' | 'crm_stage' | 'rating' | 'next_followup_at';
type SortDir = 'asc' | 'desc';

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<CRMStage | ''>('');
  const [filterCity, setFilterCity] = useState('');
  const [filterMinScore, setFilterMinScore] = useState('');
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterOptOut, setFilterOptOut] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('bottleneck_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setLeads(leadsDB.getAll());
  }, []);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    let result = [...leads];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        l =>
          l.restaurant_name.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.cuisine.toLowerCase().includes(q)
      );
    }
    if (filterStage) result = result.filter(l => l.crm_stage === filterStage);
    if (filterCity) result = result.filter(l => l.city.toLowerCase().includes(filterCity.toLowerCase()));
    if (filterMinScore) result = result.filter(l => l.bottleneck_score >= Number(filterMinScore));
    if (filterHasEmail) result = result.filter(l => !!l.email);
    if (filterOptOut) result = result.filter(l => l.opt_out);

    result.sort((a, b) => {
      let aVal: string | number = a[sortField] ?? '';
      let bVal: string | number = b[sortField] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, search, filterStage, filterCity, filterMinScore, filterHasEmail, filterOptOut, sortField, sortDir]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown size={12} className="text-mist/40" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-electric" /> : <ChevronDown size={12} className="text-electric" />;
  }

  function ColHeader({ label, field }: { label: string; field: SortField }) {
    return (
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 text-mist hover:text-paper transition-colors uppercase tracking-wider text-[10px] font-semibold whitespace-nowrap"
      >
        {label} <SortIcon field={field} />
      </button>
    );
  }

  const activeFilters = [filterStage, filterCity, filterMinScore, filterHasEmail, filterOptOut].filter(Boolean).length;

  return (
    <div className="max-w-full px-4 sm:px-6 pb-32 pt-5 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1">Restaurant AI Revenue Agent</p>
          <h1 className="display-title text-paper">Leads</h1>
          <p className="text-mist text-sm mt-1">{filtered.length} of {leads.length} leads</p>
        </div>
        <Link to="/leads/new" className="btn-primary text-sm shrink-0">
          <UserPlus size={15} /> Add Lead
        </Link>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
          <input
            type="text"
            placeholder="Search restaurant, city, cuisine…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-ghost text-sm px-3 py-2 relative ${showFilters ? 'border-electric/60 text-paper' : ''}`}
        >
          <SlidersHorizontal size={14} /> Filters
          {activeFilters > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-electric text-white text-[9px] flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass p-4 mb-4 slide-up">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label className="label">CRM Stage</label>
              <select value={filterStage} onChange={e => setFilterStage(e.target.value as CRMStage | '')}>
                <option value="">All stages</option>
                {CRM_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">City</label>
              <input type="text" placeholder="Filter by city…" value={filterCity} onChange={e => setFilterCity(e.target.value)} />
            </div>
            <div>
              <label className="label">Min Score</label>
              <input type="number" placeholder="0–100" min={0} max={100} value={filterMinScore} onChange={e => setFilterMinScore(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 pt-5">
              <label className="flex items-center gap-2 text-sm text-chalk cursor-pointer">
                <input type="checkbox" checked={filterHasEmail} onChange={e => setFilterHasEmail(e.target.checked)} className="w-4 h-4 accent-electric" />
                Has Email
              </label>
              <label className="flex items-center gap-2 text-sm text-chalk cursor-pointer">
                <input type="checkbox" checked={filterOptOut} onChange={e => setFilterOptOut(e.target.checked)} className="w-4 h-4 accent-danger" />
                Opt-Out Only
              </label>
            </div>
            <button
              onClick={() => { setFilterStage(''); setFilterCity(''); setFilterMinScore(''); setFilterHasEmail(false); setFilterOptOut(false); }}
              className="btn-ghost text-xs px-3 py-2 col-span-1"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No leads match your filters"
          description="Try adjusting your search or filter criteria."
          action={<Link to="/leads/new" className="btn-primary text-sm">Add First Lead</Link>}
        />
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="border-b border-ink-line">
                  <th className="px-4 py-3 text-left"><ColHeader label="Restaurant" field="restaurant_name" /></th>
                  <th className="px-4 py-3 text-left"><ColHeader label="City" field="city" /></th>
                  <th className="px-4 py-3 text-left"><ColHeader label="Cuisine" field="cuisine" /></th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left"><ColHeader label="Score" field="bottleneck_score" /></th>
                  <th className="px-4 py-3 text-left"><ColHeader label="Stage" field="crm_stage" /></th>
                  <th className="px-4 py-3 text-left"><ColHeader label="Rating" field="rating" /></th>
                  <th className="px-4 py-3 text-left">Offer</th>
                  <th className="px-4 py-3 text-left"><ColHeader label="Follow-Up" field="next_followup_at" /></th>
                  <th className="px-4 py-3 text-center">Opt-Out</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line/50">
                {filtered.map(lead => (
                  <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3">
                      <Link to={`/leads/${lead.id}`} className="font-semibold text-paper hover:text-electric transition-colors">
                        {lead.restaurant_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-chalk">{lead.city || '—'}</td>
                    <td className="px-4 py-3 text-chalk">{lead.cuisine || '—'}</td>
                    <td className="px-4 py-3 text-chalk whitespace-nowrap">{formatPhone(lead.phone)}</td>
                    <td className="px-4 py-3"><ScoreBadge score={lead.bottleneck_score} size="sm" /></td>
                    <td className="px-4 py-3"><StageChip stage={lead.crm_stage} /></td>
                    <td className="px-4 py-3">
                      {lead.rating > 0 ? (
                        <span className="flex items-center gap-1 text-gold-light">
                          <Star size={11} fill="currentColor" /> {lead.rating}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-chalk max-w-[160px]">
                      <span className="truncate block text-xs">{lead.recommended_offer || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-chalk text-xs whitespace-nowrap">
                      {lead.next_followup_at ? formatDate(lead.next_followup_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {lead.opt_out && <X size={14} className="text-danger mx-auto" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Link to={`/leads/${lead.id}`} className="icon-btn w-7 h-7" title="View">
                          <Eye size={12} />
                        </Link>
                        <Link to={`/audit/${lead.id}`} className="icon-btn w-7 h-7" title="Run Audit">
                          <Zap size={12} className="text-gold" />
                        </Link>
                        <Link to={`/emails/${lead.id}`} className="icon-btn w-7 h-7" title="Generate Email">
                          <Mail size={12} className="text-electric" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
