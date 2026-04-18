import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bell, BellOff, Check, CheckCheck,
  AlertTriangle, RefreshCw, Receipt, BarChart3,
  Wallet, X, Info,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, today, uuid } from '../lib/finance';

// ─── Alert type metadata ──────────────────────────────────────────────────────

const TYPE_META = {
  warning:      { icon: AlertTriangle, color: 'text-wb-red-light bg-wb-red/10 border-wb-red/20' },
  overdue:      { icon: AlertTriangle, color: 'text-wb-red-light bg-wb-red/10 border-wb-red/20' },
  bill:         { icon: Receipt,       color: 'text-wb-amber bg-wb-amber/10 border-wb-amber/20' },
  subscription: { icon: RefreshCw,     color: 'text-wb-purple bg-wb-purple/10 border-wb-purple/20' },
  budget:       { icon: BarChart3,     color: 'text-wb-gold bg-wb-gold/10 border-wb-gold/20' },
  goal:         { icon: Wallet,        color: 'text-wb-green-light bg-wb-green/10 border-wb-green/20' },
  info:         { icon: Info,          color: 'text-wb-blue-light bg-wb-blue/10 border-wb-blue/20' },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// ─── Notification card ────────────────────────────────────────────────────────

function NotifCard({ notif, onRead, onDismiss }) {
  const meta = TYPE_META[notif.type] || TYPE_META.info;
  const Icon = meta.icon;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border transition-opacity ${meta.color} ${notif.is_read ? 'opacity-50' : ''}`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold ${notif.is_read ? 'text-wb-muted' : 'text-wb-white'}`}>
            {notif.title}
          </p>
          <button
            onClick={() => onDismiss(notif.id)}
            className="p-0.5 rounded text-wb-muted hover:text-wb-white transition-colors shrink-0"
          >
            <X size={12} />
          </button>
        </div>
        <p className="text-xs text-wb-muted mt-0.5">{notif.body}</p>
        {!notif.is_read && (
          <button
            onClick={() => onRead(notif.id)}
            className="text-[10px] text-wb-blue-light mt-2 hover:underline"
          >
            Mark as read
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Notifications() {
  const navigate = useNavigate();
  const { alerts, notifications, setNotifications, accounts, subscriptions, bills, budgets, expenses, month } = useFinance();

  const [filter, setFilter] = useState('all'); // all | unread | read

  // Merge live alerts into notification-style objects for display
  const liveAlerts = useMemo(() => alerts.map(a => ({
    ...a,
    is_read: false,
    created_at: today(),
    _live: true,
  })), [alerts]);

  // Persisted notifications (from context)
  const allNotifs = useMemo(() => {
    return [...liveAlerts, ...notifications]
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 2;
        const pb = PRIORITY_ORDER[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [liveAlerts, notifications]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return allNotifs.filter(n => !n.is_read);
    if (filter === 'read')   return allNotifs.filter(n => n.is_read);
    return allNotifs;
  }, [allNotifs, filter]);

  const unread = allNotifs.filter(n => !n.is_read).length;

  function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  function dismiss(id) {
    // For live alerts (from context), nothing to persist — just skip
    // For persisted notifications, remove
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function clearAll() {
    setNotifications([]);
  }

  return (
    <Layout>
      <div className="page-container space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Alerts</h1>
            <p className="text-xs text-wb-muted">
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </p>
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} className="btn-ghost text-xs text-wb-blue-light gap-1">
              <CheckCheck size={14} /> All read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 bg-wb-card border border-wb-border rounded-xl p-1">
          {[
            { key: 'all',    label: `All (${allNotifs.length})`   },
            { key: 'unread', label: `Unread (${unread})`          },
            { key: 'read',   label: 'Read'                         },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
                filter === key
                  ? 'bg-wb-blue text-white'
                  : 'text-wb-muted hover:text-wb-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Notification list */}
        {filtered.length === 0 ? (
          <div className="card text-center py-10">
            {unread === 0 ? (
              <>
                <CheckCheck size={32} className="text-wb-green-light mx-auto mb-3" />
                <p className="text-sm font-semibold text-wb-white mb-1">All clear</p>
                <p className="text-xs text-wb-muted">No alerts right now. Keep it up!</p>
              </>
            ) : (
              <>
                <BellOff size={32} className="text-wb-muted mx-auto mb-3" />
                <p className="text-sm text-wb-muted">Nothing here</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((notif, i) => (
              <NotifCard
                key={notif.id || `live-${i}`}
                notif={notif}
                onRead={markRead}
                onDismiss={dismiss}
              />
            ))}
          </div>
        )}

        {/* Clear all */}
        {notifications.length > 0 && (
          <button
            onClick={clearAll}
            className="w-full btn-ghost text-sm text-wb-muted justify-center py-2"
          >
            Clear all saved alerts
          </button>
        )}

        {/* Info box */}
        <div className="rounded-xl bg-wb-blue/5 border border-wb-blue/15 p-4">
          <div className="flex items-start gap-2.5">
            <Bell size={14} className="text-wb-blue-light mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-wb-blue-light mb-1">About Alerts</p>
              <p className="text-xs text-wb-muted leading-relaxed">
                Alerts are generated automatically based on your bills, subscriptions, budget, and account balances.
                They refresh each time you open the app.
              </p>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
