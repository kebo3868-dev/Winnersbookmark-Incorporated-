import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, TrendingDown, AlertTriangle,
  ArrowRight, Bell, RefreshCw, Receipt, Target, Calendar,
  Zap, ChevronRight, Activity, Shield,
} from 'lucide-react';
import Layout from '../components/Layout';
import ProgressBar from '../components/ProgressBar';
import AmountDisplay from '../components/AmountDisplay';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency, daysUntil,
  budgetProgress, totalBudgetStats,
} from '../lib/finance';

function AlertBanner({ alerts, onView }) {
  if (!alerts.length) return null;
  const top = alerts[0];
  const colors = {
    high:   'border-wb-red/40 bg-wb-red/5 text-wb-red-light',
    medium: 'border-wb-amber/40 bg-wb-amber/5 text-wb-amber',
    low:    'border-wb-blue/30 bg-wb-blue/5 text-wb-blue-light',
  };
  return (
    <button
      onClick={onView}
      className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-left hover:opacity-80 ${colors[top.priority] || colors.low}`}
    >
      <AlertTriangle size={16} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{top.title}</p>
        <p className="text-xs opacity-80 truncate">{top.body}</p>
      </div>
      {alerts.length > 1 && <span className="text-xs font-bold opacity-60">+{alerts.length - 1}</span>}
      <ChevronRight size={14} className="shrink-0 opacity-60" />
    </button>
  );
}

function StatPill({ label, value, color = 'blue', onClick }) {
  const colorMap = {
    blue:  'bg-wb-blue/10 border-wb-blue/20 text-wb-blue-light',
    green: 'bg-wb-green/10 border-wb-green/20 text-wb-green-light',
    red:   'bg-wb-red/10 border-wb-red/20 text-wb-red-light',
    amber: 'bg-wb-amber/10 border-wb-amber/20 text-wb-amber',
  };
  return (
    <button
      onClick={onClick}
      className={`flex-1 border rounded-xl px-3 py-3 text-center hover:opacity-80 ${colorMap[color]}`}
    >
      <p className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </button>
  );
}

function UpcomingRow({ item }) {
  const days = item._daysUntil ?? daysUntil(item.due_date ?? item.next_due_date);
  const isOverdue = days < 0;
  const isSoon = days >= 0 && days <= 3;
  const isSub = !!item.billing_cycle;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        isOverdue ? 'bg-wb-red/10 text-wb-red-light' :
        isSoon    ? 'bg-wb-amber/10 text-wb-amber' :
                    'bg-wb-blue/10 text-wb-blue-light'}`}>
        {isSub ? <RefreshCw size={14} /> : <Receipt size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-wb-white truncate">{item.name}</p>
        <p className="text-xs text-wb-muted">{isSub ? 'Subscription' : 'Bill'}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-wb-white">{formatCurrency(item.amount)}</p>
        <p className={`text-[11px] font-medium ${isOverdue ? 'text-wb-red' : isSoon ? 'text-wb-amber' : 'text-wb-muted'}`}>
          {isOverdue ? `${Math.abs(days)}d late` : days === 0 ? 'Today' : `${days}d`}
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    profile, balance, accounts,
    thisMonthIncome, thisMonthExpenses, netFlow,
    upcoming, alerts, subMonthlyTotal,
    forecast, unreadNotifs,
    budgets, expenses, month,
  } = useFinance();

  const currentBudget = budgets.find(b => b.month === month);
  const budgetCats = currentBudget?.categories || [];
  const budgetStats = totalBudgetStats(budgetCats, expenses, month);
  const topBudgetCats = budgetProgress(budgetCats, expenses, month)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name?.split(' ')[0] || 'there';

  return (
    <Layout>
      <div className="page-container space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[10px] text-wb-muted font-medium tracking-widest uppercase mb-0.5">
              Winnersbookmark Financial
            </p>
            <h1 className="text-xl font-bold tracking-tight">{greeting}, {firstName}</h1>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className="relative w-10 h-10 rounded-xl bg-wb-card border border-wb-border flex items-center justify-center text-wb-muted hover:text-wb-white transition-colors"
          >
            <Bell size={18} />
            {unreadNotifs > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-wb-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </button>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <AlertBanner alerts={alerts} onView={() => navigate('/notifications')} />
        )}

        {/* Balance Hero */}
        <div
          className="rounded-2xl p-5 cursor-pointer hover:opacity-95 transition-opacity"
          style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#0f1f3a 60%,#0a0a0f 100%)', border: '1px solid rgba(59,130,246,0.25)' }}
          onClick={() => navigate('/accounts')}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-medium text-wb-blue-glow/70 uppercase tracking-widest mb-1">Total Balance</p>
              <AmountDisplay amount={balance} size="xl" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-wb-blue/20 border border-wb-blue/30 flex items-center justify-center">
              <Shield size={18} className="text-wb-blue-glow" />
            </div>
          </div>
          <div className="flex items-center gap-5 pt-3 border-t border-wb-blue/15">
            <div>
              <p className="text-[9px] text-wb-muted uppercase tracking-wide">Accounts</p>
              <p className="text-sm font-semibold text-wb-white">{accounts.length}</p>
            </div>
            <div className="w-px h-5 bg-wb-border" />
            <div>
              <p className="text-[9px] text-wb-muted uppercase tracking-wide">Safe to Spend</p>
              <p className={`text-sm font-semibold ${forecast.safeToSpend > 0 ? 'text-wb-green-light' : 'text-wb-red-light'}`}>
                {formatCurrency(forecast.safeToSpend)}
              </p>
            </div>
            <div className="ml-auto"><ArrowRight size={14} className="text-wb-blue-light" /></div>
          </div>
        </div>

        {/* Month Stats */}
        <div className="flex gap-2.5">
          <StatPill label="Income"  value={formatCurrency(thisMonthIncome,   'USD', true)} color="green" onClick={() => navigate('/income')} />
          <StatPill label="Spent"   value={formatCurrency(thisMonthExpenses, 'USD', true)} color={thisMonthExpenses > thisMonthIncome ? 'red' : 'blue'} onClick={() => navigate('/expenses')} />
          <StatPill label={netFlow >= 0 ? 'Surplus' : 'Deficit'} value={formatCurrency(Math.abs(netFlow), 'USD', true)} color={netFlow >= 0 ? 'green' : 'red'} onClick={() => navigate('/cashflow')} />
        </div>

        {/* Upcoming */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h2 className="section-title flex items-center gap-2">
              <Calendar size={15} className="text-wb-blue-light" />Due Soon
            </h2>
            <button onClick={() => navigate('/calendar')} className="text-xs text-wb-blue-light flex items-center gap-0.5">
              Calendar <ChevronRight size={12} />
            </button>
          </div>
          {upcoming.length === 0
            ? <p className="text-sm text-wb-muted py-4 text-center">Nothing due in the next 14 days</p>
            : <div className="divide-y divide-wb-border/40">{upcoming.slice(0, 5).map(item => <UpcomingRow key={item.id} item={item} />)}</div>
          }
          {upcoming.length > 5 && (
            <button onClick={() => navigate('/calendar')} className="w-full text-xs text-wb-blue-light pt-2 text-center">
              +{upcoming.length - 5} more upcoming
            </button>
          )}
        </div>

        {/* Budget */}
        {budgetCats.length > 0 && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title flex items-center gap-2">
                <LayoutDashboard size={15} className="text-wb-gold" />Budget
              </h2>
              <button onClick={() => navigate('/budget')} className="text-xs text-wb-blue-light flex items-center gap-0.5">
                Details <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-wb-muted">{formatCurrency(budgetStats.spent, 'USD', true)} spent</span>
              <span className={`font-semibold ${budgetStats.overBudget ? 'text-wb-red-light' : 'text-wb-green-light'}`}>
                {budgetStats.overBudget
                  ? `${formatCurrency(budgetStats.spent - budgetStats.allocated, 'USD', true)} over`
                  : `${formatCurrency(budgetStats.remaining, 'USD', true)} left`}
              </span>
            </div>
            <ProgressBar pct={budgetStats.pct} color={budgetStats.overBudget ? 'red' : budgetStats.pct > 80 ? 'amber' : 'blue'} size="md" />
            {topBudgetCats.length > 0 && (
              <div className="pt-2 space-y-3 border-t border-wb-border/40">
                {topBudgetCats.map(cat => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-wb-white truncate max-w-[140px]">{cat.category_name}</span>
                      <span className={cat.overspent ? 'text-wb-red-light font-semibold' : 'text-wb-muted'}>
                        {formatCurrency(cat.spent, 'USD', true)} / {formatCurrency(cat.allocated_amount, 'USD', true)}
                      </span>
                    </div>
                    <ProgressBar pct={cat.pct} color={cat.overspent ? 'red' : cat.pct >= 80 ? 'amber' : 'blue'} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recurring + Forecast */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card cursor-pointer hover:border-wb-purple/30 transition-colors" onClick={() => navigate('/subscriptions')}>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
              <RefreshCw size={15} className="text-wb-purple" />
            </div>
            <p className="text-xs text-wb-muted mb-0.5">Subscriptions/mo</p>
            <p className="text-base font-bold text-wb-purple">{formatCurrency(subMonthlyTotal)}</p>
            <p className="text-[10px] text-wb-muted mt-0.5">{formatCurrency(subMonthlyTotal * 12, 'USD', true)}/yr</p>
          </div>
          <div className="card cursor-pointer hover:border-wb-green/30 transition-colors" onClick={() => navigate('/cashflow')}>
            <div className="w-8 h-8 rounded-lg bg-wb-green/10 flex items-center justify-center mb-2">
              <Zap size={15} className="text-wb-green-light" />
            </div>
            <p className="text-xs text-wb-muted mb-0.5">30d Projected</p>
            <p className={`text-base font-bold ${forecast.projectedBalance >= 0 ? 'text-wb-green-light' : 'text-wb-red-light'}`}>
              {formatCurrency(forecast.projectedBalance, 'USD', true)}
            </p>
            {forecast.lowRisk && <p className="text-[10px] text-wb-amber mt-0.5">⚠ Low risk</p>}
          </div>
        </div>

        {/* Quick Nav */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Bills',    icon: Receipt,  path: '/bills',    color: 'text-wb-amber'       },
            { label: 'Goals',    icon: Target,   path: '/goals',    color: 'text-wb-green-light' },
            { label: 'Insights', icon: Activity, path: '/insights', color: 'text-wb-purple'      },
          ].map(({ label, icon: Icon, path, color }) => (
            <button key={path} onClick={() => navigate(path)}
              className="card flex flex-col items-center gap-2 py-4 hover:border-wb-blue/30 transition-colors active:scale-95">
              <Icon size={20} className={color} />
              <span className="text-xs font-medium text-wb-muted">{label}</span>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {accounts.length === 0 && (
          <div className="card border-dashed text-center py-8">
            <Shield size={32} className="text-wb-blue-light mx-auto mb-3" />
            <p className="text-sm font-semibold text-wb-white mb-1">Start tracking your money</p>
            <p className="text-xs text-wb-muted mb-4">Add accounts to see your full financial picture</p>
            <button onClick={() => navigate('/accounts')} className="btn-primary text-sm py-2.5 px-5">
              Add Account
            </button>
          </div>
        )}

        <div className="h-2" />
      </div>
    </Layout>
  );
}
