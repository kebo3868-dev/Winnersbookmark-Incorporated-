import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle,
  ChevronRight, ChevronLeft, DollarSign, Zap, Calendar,
  CreditCard, ArrowUpRight, ArrowDownRight, Activity,
} from 'lucide-react';
import Layout from '../components/Layout';
import ProgressBar from '../components/ProgressBar';
import AmountDisplay from '../components/AmountDisplay';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency, formatDateShort, formatMonth,
  cashFlowForecast, monthlyTrend,
} from '../lib/finance';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

function groupByWeek(obligations) {
  const groups = {};
  obligations.forEach(ob => {
    const key = weekOf(ob.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(ob);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function weekLabel(weekStartStr) {
  const d = new Date(weekStartStr + 'T00:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${d.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskBadge({ negativeRisk, lowRisk }) {
  if (negativeRisk) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-wb-red-muted border border-wb-red/30 text-wb-red-light">
        <AlertTriangle size={11} />
        Negative Risk
      </span>
    );
  }
  if (lowRisk) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-wb-amber-muted border border-wb-amber/30 text-wb-amber">
        <AlertCircle size={11} />
        Low Balance Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-wb-green-muted border border-wb-green/30 text-wb-green-light">
      <Zap size={11} />
      Looking Good
    </span>
  );
}

function TypeBadge({ type }) {
  if (type === 'bill') {
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-wb-red-muted text-wb-red-light border border-wb-red/20">
        Bill
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-wb-blue-muted text-wb-blue-light border border-wb-blue/20">
      Sub
    </span>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function TrendChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-32">
        {data.map((d, i) => {
          const incH = Math.round((d.income / maxVal) * 100);
          const expH = Math.round((d.expenses / maxVal) * 100);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '100px' }}>
                <div
                  className="flex-1 bg-wb-green rounded-t opacity-80"
                  style={{ height: `${incH}%`, minHeight: d.income > 0 ? '2px' : '0' }}
                  title={`Income: ${formatCurrency(d.income)}`}
                />
                <div
                  className="flex-1 bg-wb-red rounded-t opacity-70"
                  style={{ height: `${expH}%`, minHeight: d.expenses > 0 ? '2px' : '0' }}
                  title={`Expenses: ${formatCurrency(d.expenses)}`}
                />
              </div>
              <span className="text-[10px] text-wb-muted">{d.label}</span>
            </div>
          );
        })}
      </div>

      {/* Net row */}
      <div className="grid grid-cols-6 gap-2">
        {data.map((d, i) => (
          <div key={i} className="text-center">
            <span className={`text-[10px] font-semibold ${d.net >= 0 ? 'text-wb-green-light' : 'text-wb-red-light'}`}>
              {d.net >= 0 ? '+' : ''}{formatCurrency(d.net, 'USD', true)}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-wb-green opacity-80" />
          <span className="text-xs text-wb-muted">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-wb-red opacity-70" />
          <span className="text-xs text-wb-muted">Expenses</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CashFlow() {
  const { accounts, income, expenses, subscriptions, bills, forecast } = useFinance();
  const [days, setDays] = useState(30);

  const fc = useMemo(
    () => days === 30 ? forecast : cashFlowForecast(accounts, income, subscriptions, bills, days),
    [days, accounts, income, subscriptions, bills, forecast],
  );

  const trend = useMemo(() => monthlyTrend(income, expenses), [income, expenses]);

  const safeColor = fc.safeToSpend > 500
    ? 'text-wb-green-light'
    : fc.safeToSpend >= 100
    ? 'text-wb-amber'
    : 'text-wb-red-light';

  const safeBg = fc.safeToSpend > 500
    ? 'bg-wb-green-muted border-wb-green/20'
    : fc.safeToSpend >= 100
    ? 'bg-wb-amber-muted border-wb-amber/20'
    : 'bg-wb-red-muted border-wb-red/20';

  // Meter: current balance as % of a reasonable scale
  const meterScale = Math.max(Math.abs(fc.currentBalance), Math.abs(fc.projectedBalance), 100);
  const currentPct = Math.min(100, Math.max(0, (fc.currentBalance / meterScale) * 100));
  const projectedPct = Math.min(100, Math.max(0, (fc.projectedBalance / meterScale) * 100));
  const projColor = fc.projectedBalance >= 0 ? 'green' : 'red';

  // Running balance
  let runningBal = fc.currentBalance;
  const obligationsWithBalance = fc.upcomingObligations.map(ob => {
    runningBal -= ob.amount;
    return { ...ob, runningBalance: runningBal };
  });

  const weeklyGroups = groupByWeek(obligationsWithBalance);

  return (
    <Layout>
      <div className="page-container space-y-5 fade-in">

        {/* ── Header ── */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cash Flow</h1>
            <p className="text-sm text-wb-muted mt-0.5">{days}-day projection</p>
          </div>
          {/* 7d / 30d toggle */}
          <div className="flex gap-1 bg-wb-dark border border-wb-border rounded-xl p-1">
            {[7, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  days === d
                    ? 'bg-wb-blue text-white shadow'
                    : 'text-wb-muted hover:text-wb-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* ── Projection Hero ── */}
        <div className="card space-y-4 border-wb-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="label">Projected Balance ({days}d)</p>
              <AmountDisplay
                amount={fc.projectedBalance}
                size="3xl"
                positive={fc.projectedBalance >= 0}
                negative={fc.projectedBalance < 0}
              />
            </div>
            <RiskBadge negativeRisk={fc.negativeRisk} lowRisk={fc.lowRisk} />
          </div>

          {/* Meter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-wb-muted">
              <span>Current: {formatCurrency(fc.currentBalance)}</span>
              <span>Projected: {formatCurrency(fc.projectedBalance)}</span>
            </div>
            <div className="relative h-3 bg-wb-border rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-wb-blue-muted rounded-full"
                style={{ width: `${currentPct}%` }}
              />
              <div
                className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${
                  projColor === 'green' ? 'bg-wb-green' : 'bg-wb-red'
                } opacity-70`}
                style={{ width: `${projectedPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Income / Expenses cards ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-wb-green-muted">
                <ArrowUpRight size={14} className="text-wb-green-light" />
              </div>
              <span className="text-xs text-wb-muted">Expected Income</span>
            </div>
            <span className="text-lg font-bold text-wb-green-light tabular-nums">
              {formatCurrency(fc.expectedIncome)}
            </span>
          </div>
          <div className="card space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-wb-red-muted">
                <ArrowDownRight size={14} className="text-wb-red-light" />
              </div>
              <span className="text-xs text-wb-muted">Expected Expenses</span>
            </div>
            <span className="text-lg font-bold text-wb-red-light tabular-nums">
              {formatCurrency(fc.expectedExpenses)}
            </span>
          </div>
        </div>

        {/* ── Safe to Spend ── */}
        <div className={`card border ${safeBg} space-y-2`}>
          <div className="flex items-center gap-2">
            <DollarSign size={16} className={safeColor} />
            <span className="section-title">Safe to Spend</span>
          </div>
          <span className={`text-3xl font-bold tabular-nums ${safeColor}`}>
            {formatCurrency(fc.safeToSpend)}
          </span>
          <p className="text-xs text-wb-muted leading-relaxed">
            Current balance minus upcoming obligations, with a $200 buffer.
          </p>
        </div>

        {/* ── Upcoming Obligations ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-wb-blue-light" />
            <span className="section-title">Upcoming Obligations</span>
            <span className="ml-auto text-xs text-wb-muted">{fc.upcomingObligations.length} items</span>
          </div>

          {fc.upcomingObligations.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-wb-muted text-sm">No upcoming obligations in the next {days} days.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weeklyGroups.map(([weekStart, items]) => (
                <div key={weekStart} className="space-y-2">
                  <p className="text-xs font-semibold text-wb-muted uppercase tracking-wider px-1">
                    {weekLabel(weekStart)}
                  </p>
                  <div className="card p-0 overflow-hidden divide-y divide-wb-border">
                    {items.map((ob, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <TypeBadge type={ob.type} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-wb-white truncate">{ob.name}</p>
                            <p className="text-xs text-wb-muted">{formatDateShort(ob.date)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-sm font-semibold text-wb-red-light tabular-nums">
                            −{formatCurrency(ob.amount)}
                          </p>
                          <p className={`text-xs tabular-nums ${ob.runningBalance >= 0 ? 'text-wb-muted' : 'text-wb-red-light'}`}>
                            {formatCurrency(ob.runningBalance)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Monthly Trend ── */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-wb-blue-light" />
            <span className="section-title">6-Month Cash Flow</span>
          </div>
          <TrendChart data={trend} />
        </div>

      </div>
    </Layout>
  );
}
