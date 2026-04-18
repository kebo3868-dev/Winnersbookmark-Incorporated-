import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  RefreshCw, Receipt, TrendingUp, Calendar as CalIcon,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, calendarEvents, today, addDays } from '../lib/finance';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthName(y, m) {
  return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function firstDayOfWeek(y, m) {
  return new Date(y, m, 1).getDay();
}

const TYPE_META = {
  subscription: { icon: RefreshCw,  color: 'bg-wb-purple/15 text-wb-purple border-wb-purple/20',     dot: 'bg-wb-purple'      },
  bill:         { icon: Receipt,    color: 'bg-wb-amber/15 text-wb-amber border-wb-amber/20',         dot: 'bg-wb-amber'       },
  income:       { icon: TrendingUp, color: 'bg-wb-green/15 text-wb-green-light border-wb-green/20',   dot: 'bg-wb-green-light' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({ year, month, events, selectedDay, onSelectDay }) {
  const todayStr = today();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const days = daysInMonth(year, month);
  const offset = firstDayOfWeek(year, month);

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const d = e.date.split('-')[2];
      const m = e.date.slice(0, 7);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${d}`;
      if (e.date.startsWith(key.slice(0, 7))) {
        if (!map[d]) map[d] = [];
        map[d].push(e);
      }
    });
    return map;
  }, [events, year, month]);

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const isToday  = (d) => ty === year && tm - 1 === month && td === d;
  const isSelect = (d) => selectedDay === d;

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-wb-muted py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const dots = eventsByDay[String(d)] || [];
          const uniqueTypes = [...new Set(dots.map(e => e.type))];
          return (
            <button
              key={d}
              onClick={() => onSelectDay(isSelect(d) ? null : d)}
              className={`relative flex flex-col items-center py-1.5 rounded-lg transition-colors ${
                isSelect(d) ? 'bg-wb-blue text-white' :
                isToday(d)  ? 'bg-wb-blue/20 text-wb-blue-light font-bold' :
                              'hover:bg-wb-border text-wb-white'
              }`}
            >
              <span className="text-xs font-medium">{d}</span>
              {uniqueTypes.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {uniqueTypes.slice(0, 3).map(t => (
                    <span key={t} className={`w-1 h-1 rounded-full ${TYPE_META[t]?.dot || 'bg-wb-muted'}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event }) {
  const meta = TYPE_META[event.type] || TYPE_META.bill;
  const Icon = meta.icon;
  const paid = event.status === 'paid';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${paid ? 'opacity-50' : meta.color}`}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${paid ? 'line-through text-wb-muted' : 'text-wb-white'}`}>{event.name}</p>
        <p className="text-[10px] capitalize text-wb-muted">{event.type}</p>
      </div>
      <p className="text-sm font-semibold shrink-0">
        {event.type === 'income' ? '+' : '−'}{formatCurrency(event.amount)}
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate = useNavigate();
  const { subscriptions, bills, income } = useFinance();

  const todayStr = today();
  const [ty, tm] = todayStr.split('-').map(Number);

  const [viewYear,  setViewYear]  = useState(ty);
  const [viewMonth, setViewMonth] = useState(tm - 1);
  const [selDay,    setSelDay]    = useState(null);

  const allEvents = useMemo(
    () => calendarEvents(subscriptions, bills, income, 90),
    [subscriptions, bills, income],
  );

  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const monthEvents = useMemo(
    () => allEvents.filter(e => e.date.startsWith(monthStr)),
    [allEvents, monthStr],
  );

  const selectedDayStr = selDay
    ? `${monthStr}-${String(selDay).padStart(2, '0')}`
    : null;

  const selectedEvents = useMemo(
    () => selectedDayStr
      ? allEvents.filter(e => e.date === selectedDayStr)
      : monthEvents,
    [allEvents, monthEvents, selectedDayStr],
  );

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelDay(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelDay(null);
  }

  const incomeEvents = monthEvents.filter(e => e.type === 'income');
  const billEvents   = monthEvents.filter(e => e.type === 'bill');
  const subEvents    = monthEvents.filter(e => e.type === 'subscription');
  const totalOut     = [...billEvents, ...subEvents].reduce((s, e) => s + e.amount, 0);
  const totalIn      = incomeEvents.reduce((s, e) => s + e.amount, 0);

  return (
    <Layout>
      <div className="page-container space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
          <h1 className="text-xl font-bold tracking-tight flex-1">Financial Calendar</h1>
        </div>

        {/* Month summary pills */}
        <div className="flex gap-2.5">
          {[
            { label: 'Income',  value: formatCurrency(totalIn, 'USD', true),  color: 'bg-wb-green/10 border-wb-green/20 text-wb-green-light' },
            { label: 'Bills',   value: formatCurrency(totalOut, 'USD', true), color: 'bg-wb-amber/10 border-wb-amber/20 text-wb-amber'       },
            { label: 'Events',  value: String(monthEvents.length),             color: 'bg-wb-blue/10 border-wb-blue/20 text-wb-blue-light'    },
          ].map(({ label, value, color }) => (
            <div key={label} className={`flex-1 border rounded-xl px-3 py-2.5 text-center ${color}`}>
              <p className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">{label}</p>
              <p className="text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-lg text-wb-muted hover:text-wb-white hover:bg-wb-border transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-semibold text-wb-white">{monthName(viewYear, viewMonth)}</h2>
            <button onClick={nextMonth} className="p-2 rounded-lg text-wb-muted hover:text-wb-white hover:bg-wb-border transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            events={monthEvents}
            selectedDay={selDay}
            onSelectDay={setSelDay}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-1">
          {[
            { dot: 'bg-wb-green-light', label: 'Income' },
            { dot: 'bg-wb-amber',       label: 'Bills'   },
            { dot: 'bg-wb-purple',      label: 'Subscriptions' },
          ].map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-wb-muted">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {label}
            </div>
          ))}
        </div>

        {/* Events list */}
        <div>
          <h2 className="section-title flex items-center gap-2 mb-3">
            <CalIcon size={15} className="text-wb-blue-light" />
            {selDay ? `${monthName(viewYear, viewMonth).split(' ')[0]} ${selDay}` : 'All Events This Month'}
          </h2>
          {selectedEvents.length === 0 ? (
            <div className="card text-center py-8">
              <CalIcon size={28} className="text-wb-muted mx-auto mb-2" />
              <p className="text-sm text-wb-muted">
                {selDay ? 'No events on this day' : 'No events this month'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((e, i) => <EventRow key={`${e.id}-${i}`} event={e} />)}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
