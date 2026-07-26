import { useMemo, useState } from 'react';
import {
  Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  Circle, Clock3, Command, FileText, Inbox, LayoutDashboard, Lightbulb,
  ListTodo, Mail, Menu, MessageSquareText, Mic, MoreHorizontal, Plus,
  Search, Settings, Sparkles, Sunrise, Target, Users, Wand2, X,
} from 'lucide-react';

const navItems = [
  [LayoutDashboard, 'Overview'], [CalendarDays, 'Calendar'], [Mail, 'Inbox'],
  [ListTodo, 'Tasks'], [FileText, 'Notes'], [Users, 'Contacts'],
];

const initialTasks = [
  { id: 1, title: 'Review Q3 growth strategy', meta: 'Due today · Strategy', priority: 'High', done: false },
  { id: 2, title: 'Approve website redesign', meta: 'Due today · Marketing', priority: 'High', done: false },
  { id: 3, title: 'Send investor update', meta: 'Due Jul 28 · Finance', priority: 'Medium', done: false },
  { id: 4, title: 'Book leadership offsite venue', meta: 'Due Aug 2 · Operations', priority: 'Delegatable', done: false },
];

const meetings = [
  { time: '9:00', period: 'AM', title: 'Executive stand-up', detail: 'Leadership team · Google Meet', color: '#8b5cf6', duration: '30 min' },
  { time: '11:00', period: 'AM', title: 'Product roadmap review', detail: 'Product & Engineering · Boardroom', color: '#2563eb', duration: '60 min' },
  { time: '2:30', period: 'PM', title: 'Investor check-in', detail: 'Sarah Chen · Zoom', color: '#e59b34', duration: '30 min' },
];

function Avatar({ initials, tone = 'blue' }) {
  return <span className={`assistant-avatar assistant-avatar--${tone}`}>{initials}</span>;
}

function Panel({ children, className = '' }) {
  return <section className={`assistant-panel ${className}`}>{children}</section>;
}

export default function Dashboard() {
  const [active, setActive] = useState('Overview');
  const [tasks, setTasks] = useState(initialTasks);
  const [command, setCommand] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  const completed = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const runCommand = (event) => {
    event.preventDefault();
    if (!command.trim()) return;
    notify(`Winnersbookmark is working on “${command.trim()}”`);
    setCommand('');
  };

  return (
    <div className="assistant-shell">
      <aside className={`assistant-sidebar ${mobileNav ? 'is-open' : ''}`}>
        <div className="assistant-brand">
          <div className="assistant-brand-mark"><Wand2 size={20} /></div>
          <div><strong>Winnersbookmark</strong><span>Executive AI</span></div>
          <button className="assistant-mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav className="assistant-nav" aria-label="Assistant navigation">
          <span className="assistant-nav-label">Workspace</span>
          {navItems.map(([Icon, label]) => (
            <button key={label} className={active === label ? 'active' : ''} onClick={() => { setActive(label); setMobileNav(false); }}>
              <Icon size={18} /><span>{label}</span>{label === 'Inbox' && <b>5</b>}
            </button>
          ))}
          <span className="assistant-nav-label nav-gap">Intelligence</span>
          <button onClick={() => notify('Daily briefing is up to date.')}><Sunrise size={18} /><span>Daily Briefing</span></button>
          <button onClick={() => notify('Strategy workspace opened.')}><Target size={18} /><span>Strategy</span></button>
        </nav>
        <div className="assistant-usage">
          <div><Sparkles size={16} /><strong>Pro workspace</strong></div>
          <p>18 of 25 AI actions used</p>
          <span><i style={{ width: '72%' }} /></span>
          <button onClick={() => notify('Plan details opened.')}>View plan</button>
        </div>
        <div className="assistant-profile">
          <Avatar initials="KW" tone="navy" />
          <div><strong>Keith Weaver</strong><span>Founder workspace</span></div>
          <MoreHorizontal size={18} />
        </div>
      </aside>

      {mobileNav && <button className="assistant-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      <main className="assistant-main">
        <header className="assistant-topbar">
          <button className="assistant-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="assistant-search"><Search size={17} /><input aria-label="Search" placeholder="Search anything..." /><kbd>⌘ K</kbd></div>
          <div className="assistant-top-actions">
            <button aria-label="Notifications" onClick={() => notify('You have 3 new notifications.')}><Bell size={19} /><i /></button>
            <button aria-label="Settings"><Settings size={19} /></button>
            <Avatar initials="KW" tone="navy" />
          </div>
        </header>

        <div className="assistant-content">
          <div className="assistant-heading">
            <div><p>Sunday, July 26</p><h1>Good morning, Keith.</h1><span>Here’s what needs your attention today.</span></div>
            <button className="assistant-primary" onClick={() => notify('New item menu opened.')}><Plus size={18} /> Create new <ChevronDown size={15} /></button>
          </div>

          <Panel className="briefing-card">
            <div className="briefing-icon"><Sparkles size={21} /></div>
            <div className="briefing-copy">
              <div className="panel-kicker">Your morning briefing</div>
              <h2>A focused day with room to think.</h2>
              <p>You have <strong>3 meetings</strong> and <strong>4 priority tasks</strong>. I protected a 90-minute focus block this morning. Your investor update is the most time-sensitive item.</p>
            </div>
            <button onClick={() => notify('Full briefing opened.')}>View full briefing <ChevronRight size={16} /></button>
          </Panel>

          <div className="assistant-stats">
            <Panel><span className="stat-icon blue"><CalendarDays size={19} /></span><div><small>Today’s schedule</small><strong>3 meetings</strong><p><Clock3 size={13} /> Next at 9:00 AM</p></div></Panel>
            <Panel><span className="stat-icon amber"><ListTodo size={19} /></span><div><small>Open tasks</small><strong>{tasks.length - completed} priorities</strong><p className="urgent"><Circle size={8} fill="currentColor" /> 2 due today</p></div></Panel>
            <Panel><span className="stat-icon violet"><Mail size={19} /></span><div><small>Inbox</small><strong>5 need replies</strong><p>12 summarized by AI</p></div></Panel>
            <Panel><span className="stat-icon green"><Target size={19} /></span><div><small>Focus time</small><strong>2h 30m</strong><p>38% of your workday</p></div></Panel>
          </div>

          <div className="assistant-grid">
            <Panel className="schedule-panel">
              <div className="panel-header"><div><h3>Today’s schedule</h3><p>Sunday, July 26</p></div><button onClick={() => setActive('Calendar')}>View calendar <ChevronRight size={15} /></button></div>
              <div className="focus-block"><span><Sparkles size={15} /></span><div><strong>Focus time protected</strong><p>9:30–11:00 AM · Deep work</p></div><button aria-label="Focus options"><MoreHorizontal size={18} /></button></div>
              <div className="meeting-list">
                {meetings.map((meeting) => <div className="meeting" key={meeting.title}>
                  <time>{meeting.time}<span>{meeting.period}</span></time><i style={{ background: meeting.color }} />
                  <div><strong>{meeting.title}</strong><p>{meeting.detail}</p></div><small>{meeting.duration}</small>
                </div>)}
              </div>
              <button className="add-link" onClick={() => notify('Calendar composer opened.')}><Plus size={16} /> Add to calendar</button>
            </Panel>

            <Panel className="tasks-panel">
              <div className="panel-header"><div><h3>Priority tasks</h3><p>{tasks.length - completed} remaining today</p></div><button onClick={() => setActive('Tasks')}>View all <ChevronRight size={15} /></button></div>
              <div className="task-progress"><span><i style={{ width: `${Math.max(8, completed / tasks.length * 100)}%` }} /></span><small>{completed} of {tasks.length} complete</small></div>
              <div className="task-list">
                {tasks.map((task) => <button className={`task ${task.done ? 'done' : ''}`} key={task.id} onClick={() => setTasks((all) => all.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}>
                  {task.done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                  <div><strong>{task.title}</strong><p>{task.meta}</p></div><em className={`priority-${task.priority.toLowerCase()}`}>{task.priority}</em>
                </button>)}
              </div>
              <button className="add-link" onClick={() => notify('Task composer opened.')}><Plus size={16} /> Add a task</button>
            </Panel>

            <Panel className="inbox-panel">
              <div className="panel-header"><div><h3>Inbox intelligence</h3><p>AI-sorted by importance</p></div><button onClick={() => setActive('Inbox')}>Open inbox <ChevronRight size={15} /></button></div>
              <div className="email"><Avatar initials="SC" tone="purple" /><div><strong>Sarah Chen</strong><b>Quarterly investor update</b><p>Can you send the revised metrics before...</p></div><time>8:42 AM</time></div>
              <div className="email"><Avatar initials="DM" tone="green" /><div><strong>David Miller</strong><b>Website redesign — final review</b><p>The new homepage is ready for your approval...</p></div><time>Yesterday</time></div>
              <div className="ai-summary"><Sparkles size={16} /><p><strong>AI summary</strong> 12 newsletters and low-priority messages were grouped for later.</p><button onClick={() => notify('Email digest opened.')}>Review</button></div>
            </Panel>

            <Panel className="insight-panel">
              <div className="panel-header"><div><h3>Winnersbookmark insight</h3><p>Proactive recommendation</p></div><span className="online-dot">AI active</span></div>
              <div className="insight-body"><span><Lightbulb size={19} /></span><div><strong>Your Thursday is overbooked.</strong><p>You have 6 meetings with no focus time. I can move two lower-priority sessions to Friday afternoon.</p></div></div>
              <div className="insight-actions"><button className="assistant-primary" onClick={() => notify('I moved 2 flexible meetings to Friday.') }><Check size={16} /> Optimize my calendar</button><button onClick={() => notify('Recommendation dismissed.')}>Not now</button></div>
            </Panel>
          </div>

          <form className="command-bar" onSubmit={runCommand}>
            <div className="command-orb"><Command size={18} /></div>
            <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Ask Winnersbookmark anything — schedule a meeting, draft a reply, set a priority..." aria-label="Ask Winnersbookmark" />
            <button type="button" className="mic-button" aria-label="Voice command" onClick={() => notify('Voice mode is ready.')}><Mic size={19} /></button>
            <button className="command-send" aria-label="Send command"><MessageSquareText size={18} /></button>
          </form>
          <p className="command-hint">Winnersbookmark can make mistakes. Review important actions before confirming.</p>
        </div>
      </main>
      {toast && <div className="assistant-toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}
