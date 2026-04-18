import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, TrendingDown, BarChart3,
  RefreshCw, Target, Activity, DollarSign, Calendar,
} from 'lucide-react';
import Layout from '../components/Layout';
import ProgressBar from '../components/ProgressBar';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency, formatMonth, last6Months, monthlyTrend,
  subscriptionMonthlyTotal, subscriptionAnnualTotal,
  spendingByCategory, monthlyIncome, monthlyExpenses,
  totalBudgetStats, budgetProgress,
} from '../lib/finance';

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function BarMini({ data, field, color = 'bg-wb-blue', label }) {
  const max = Math.max(...data.map(d => d[field]), 1);
  return (
    <div>
      {label && <p className="text-xs text-wb-muted mb-2">{label}</p>}
      <div className="flex items-end gap-1 h-16">
        {data.map((d, i) => {
          const pct = (d[field] / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                <div
                  className={`w-full rounded-sm ${color} transition-all`}
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="text-[9px] text-wb-muted">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({ label, value, sub, color }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-wb-border/40 last:border-0">
      <span className="text-sm text-wb-muted">{label}</span>
      <div className="text-right">
        <p className={`text-sm font-semibold ${color || 'text-wb-white'}`}>{value}</p>
        {sub && <p className="text-[10px] text-wb-muted">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Insights() {
  const navigate  = useNavigate();
  const {
    income, expenses, subscriptions, bills,
    accounts, budgets, goals, month,
  } = useFinance();

  const trend = useMemo(() => monthlyTrend(income, expenses), [income, expenses]);
  const months = last6Months();

  // Aggregates across all 6 months
  const totalIncome6mo   = trend.reduce((s, m) => s + m.income, 0);
  const totalExpenses6mo = trend.reduce((s, m) => s + m.expenses, 0);
  const avgIncome        = totalIncome6mo / 6;
  const avgExpenses      = totalExpenses6mo / 6;

  // This month
  const thisIncome   = monthlyIncome(income, month);
  const thisExpenses = monthlyExpenses(expenses, month);
  const netFlow      = thisIncome - thisExpenses;

  // Category spending this month
  const catSpend = useMemo(() => {
    const obj = spendingByCategory(expenses, month);
    return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [expenses, month]);

  // Subscription stats
  const subMonthly = subscriptionMonthlyTotal(subscriptions);
  const subAnnual  = subscriptionAnnualTotal(subscriptions);

  // Budget
  const budget = budgets.find(b => b.month === month);
  const budgetStats = useMemo(
    () => totalBudgetStats(budget?.categories || [], expenses, month),
    [budget, expenses, month],
  );

  // Best and worst months
  const best  = trend.reduce((best, m) => m.net > best.net ? m : best, trend[0] || { net: 0, label: '-' });
  const worst = trend.reduce((wst,  m) => m.net < wst.net  ? m : wst,  trend[0] || { net: 0, label: '-' });

  // Goals
  const totalGoalTarget  = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalGoalCurrent = goals.reduce((s, g) => s + Number(g.current_amount), 0);

  return (
    <Layout>
      <div className="page-container space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Insights</h1>
            <p className="text-xs text-wb-muted">Last 6 months</p>
          </div>
        </div>

        {/* 6-month summary */}
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg,#0f1f3a 0%,#0a0a0f 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <p className="text-[10px] text-wb-blue-light/70 uppercase tracking-widest mb-3">6-Month Overview</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-wb-muted">Total Income</p>
              <p className="text-xl font-bold text-wb-green-light">{formatCurrency(totalIncome6mo, 'USD', true)}</p>
              <p className="text-[10px] text-wb-muted">avg {formatCurrency(avgIncome, 'USD', true)}/mo</p>
            </div>
            <div>
              <p className="text-xs text-wb-muted">Total Spent</p>
              <p className="text-xl font-bold text-wb-red-light">{formatCurrency(totalExpenses6mo, 'USD', true)}</p>
              <p className="text-[10px] text-wb-muted">avg {formatCurrency(avgExpenses, 'USD', true)}/mo</p>
            </div>
          </div>
        </div>

        {/* Income vs Expense chart */}
        <div className="card space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Activity size={15} className="text-wb-blue-light" />Cash Flow Trend
          </h2>
          {trend.every(t => t.income === 0 && t.expenses === 0) ? (
            <p className="text-sm text-wb-muted text-center py-4">Add income and expenses to see trends</p>
          ) : (
            <div className="space-y-4">
              <BarMini data={trend} field="income"   color="bg-wb-green/70" label="Income" />
              <BarMini data={trend} field="expenses" color="bg-wb-red/60"   label="Expenses" />
            </div>
          )}
        </div>

        {/* This month stats */}
        <div className="card">
          <h2 className="section-title flex items-center gap-2 mb-3">
            <Calendar size={15} className="text-wb-gold" />{formatMonth(month)}
          </h2>
          <StatRow label="Income"    value={formatCurrency(thisIncome)}   color="text-wb-green-light" />
          <StatRow label="Expenses"  value={formatCurrency(thisExpenses)} color="text-wb-red-light" />
          <StatRow
            label="Net Flow"
            value={formatCurrency(Math.abs(netFlow))}
            sub={netFlow >= 0 ? 'surplus' : 'deficit'}
            color={netFlow >= 0 ? 'text-wb-green-light' : 'text-wb-red-light'}
          />
          {budget && (
            <StatRow
              label="Budget Used"
              value={`${Math.round(budgetStats.pct)}%`}
              sub={budgetStats.overBudget ? 'over budget' : `${formatCurrency(budgetStats.remaining)} left`}
              color={budgetStats.overBudget ? 'text-wb-red-light' : 'text-wb-white'}
            />
          )}
        </div>

        {/* Spending by category */}
        {catSpend.length > 0 && (
          <div className="card space-y-3">
            <h2 className="section-title flex items-center gap-2">
              <BarChart3 size={15} className="text-wb-amber" />Spending by Category
            </h2>
            {catSpend.map(([cat, amt]) => {
              const pct = thisExpenses > 0 ? (amt / thisExpenses) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-wb-white truncate">{cat}</span>
                    <span className="text-wb-muted shrink-0 ml-2">
                      {formatCurrency(amt)} · {Math.round(pct)}%
                    </span>
                  </div>
                  <ProgressBar pct={pct} color="amber" size="sm" />
                </div>
              );
            })}
          </div>
        )}

        {/* Subscriptions */}
        <div className="card">
          <h2 className="section-title flex items-center gap-2 mb-3">
            <RefreshCw size={15} className="text-wb-purple" />Subscription Impact
          </h2>
          <StatRow label="Monthly cost"  value={formatCurrency(subMonthly)} color="text-wb-purple" />
          <StatRow label="Annual cost"   value={formatCurrency(subAnnual)}  color="text-wb-purple" />
          {thisIncome > 0 && (
            <StatRow
              label="% of income"
              value={`${Math.round((subMonthly / (thisIncome || 1)) * 100)}%`}
              sub="of this month's income"
              color={subMonthly / (thisIncome || 1) > 0.2 ? 'text-wb-red-light' : 'text-wb-white'}
            />
          )}
          <StatRow label="Active subs"  value={String(subscriptions.filter(s => s.is_active).length)} />
        </div>

        {/* Best / Worst months */}
        {trend.some(t => t.income > 0 || t.expenses > 0) && (
          <div className="card">
            <h2 className="section-title flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-wb-green-light" />Monthly Highlights
            </h2>
            <StatRow
              label="Best month"
              value={best.label}
              sub={`net ${formatCurrency(best.net, 'USD', true)}`}
              color="text-wb-green-light"
            />
            <StatRow
              label="Worst month"
              value={worst.label}
              sub={`net ${formatCurrency(worst.net, 'USD', true)}`}
              color={worst.net < 0 ? 'text-wb-red-light' : 'text-wb-white'}
            />
          </div>
        )}

        {/* Goals summary */}
        {goals.length > 0 && (
          <div className="card">
            <h2 className="section-title flex items-center gap-2 mb-3">
              <Target size={15} className="text-wb-green-light" />Savings Progress
            </h2>
            <StatRow label="Total saved"  value={formatCurrency(totalGoalCurrent)} color="text-wb-green-light" />
            <StatRow label="Total target" value={formatCurrency(totalGoalTarget)} />
            {totalGoalTarget > 0 && (
              <div className="mt-2">
                <ProgressBar pct={(totalGoalCurrent / totalGoalTarget) * 100} color="green" size="md" />
                <p className="text-xs text-wb-muted mt-1 text-right">
                  {Math.round((totalGoalCurrent / totalGoalTarget) * 100)}% of all goals
                </p>
              </div>
            )}
          </div>
        )}

        <div className="h-2" />
      </div>
    </Layout>
  );
}
