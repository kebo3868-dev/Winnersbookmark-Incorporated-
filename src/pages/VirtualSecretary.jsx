import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  Mic,
  Network,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import Layout from '../components/Layout';
import SectionHeading from '../components/SectionHeading';
import { useMeta } from '../lib/useMeta';

const layers = [
  {
    title: 'Information Layer',
    description: 'Connects calendars, email, tasks, notes, and contacts so the assistant has the context to support a busy operator.',
    items: ['Calendar', 'Gmail', 'Tasks', 'Notes vault', 'Contacts'],
    icon: Network,
  },
  {
    title: 'Decision Layer',
    description: 'Scores urgency, detects conflicts, protects focus time, and identifies which work should be delegated or delayed.',
    items: ['Priority scoring', 'Schedule optimization', 'Meeting value analysis', 'Delegation detection'],
    icon: BrainCircuit,
  },
  {
    title: 'Execution Layer',
    description: 'Turns decisions into action through drafted messages, created events, organized tasks, reminders, and automation triggers.',
    items: ['Email drafts', 'Meeting booking', 'Task creation', 'Reports', 'Automations'],
    icon: Zap,
  },
];

const capabilities = [
  { icon: CalendarDays, title: 'Calendar Management', body: 'Suggest optimal time slots, detect conflicts, create focus blocks, and flag overbooked days before they drain momentum.' },
  { icon: Mail, title: 'Email Management', body: 'Summarize inbox activity, surface urgent messages, draft professional replies, and convert follow-ups into tasks.' },
  { icon: CheckCircle2, title: 'Task Prioritization', body: 'Classify work as high, medium, low, or delegatable so each day starts with a clear execution plan.' },
  { icon: Clock3, title: 'Daily Briefing', body: 'Generate a morning command center with the schedule, top three priorities, urgent emails, deadlines, and recommended focus blocks.' },
  { icon: FileText, title: 'Meeting Preparation', body: 'Produce concise pre-meeting briefs with participants, talking points, prior notes, and suggested outcomes.' },
  { icon: Mic, title: 'Voice Commands', body: 'Support natural commands such as scheduling meetings, summarizing email, and asking for today’s priorities.' },
];

const agents = [
  'Scheduler AI protects the calendar and negotiates time.',
  'Communication AI summarizes, drafts, and routes messages.',
  'Strategy AI recommends priorities and weekly operating decisions.',
];

const schemaRows = [
  ['users', 'Profile, working hours, preferences, connected accounts, consent records'],
  ['calendar_events', 'Meetings, focus blocks, deadlines, attendees, conflict status'],
  ['messages', 'Email metadata, summaries, urgency score, draft status, task links'],
  ['tasks', 'Priority, due date, source, delegation status, owner, completion state'],
  ['notes', 'Meeting notes, ideas, business plans, tags, embeddings-ready content'],
  ['briefings', 'Daily summary, top priorities, recommendations, generated timestamp'],
  ['automation_logs', 'Action type, integration, payload reference, result, audit trail'],
];

export default function VirtualSecretary() {
  useMeta(
    'Winnersbookmark Virtual Secretary AI | Executive Operations Manager',
    'A modular AI executive assistant concept for calendar management, email triage, priorities, meeting prep, notes, voice commands, and business automation.'
  );

  return (
    <Layout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 left-0 h-96 w-96 rounded-full bg-electric/20 blur-3xl" />
          <div className="absolute top-20 right-0 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-[1.05fr_.95fr] gap-10 items-center">
          <div className="slide-up">
            <div className="chip-gold mb-5"><Sparkles size={14} /> AI Chief-of-Staff System</div>
            <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-[1.04] tracking-tight text-paper">
              Winnersbookmark <span className="text-gradient-electric">Virtual Secretary AI</span>
            </h1>
            <p className="mt-5 text-lg text-chalk leading-relaxed max-w-2xl">
              A calm, professional executive operations manager designed to protect time, reduce administrative load, and keep high-performance operators focused on the work that matters.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <a href="#architecture" className="btn-gold text-base">View Architecture <ArrowRight size={17} /></a>
              <Link to="/contact" className="btn-ghost !px-5 !py-3 text-base">Discuss Build Scope</Link>
            </div>
          </div>

          <div className="glass-strong card-pad-lg accent-top">
            <div className="eyebrow mb-3">Morning Briefing Preview</div>
            <h2 className="section-title mb-4">Today’s command center</h2>
            <div className="space-y-3">
              {['Top 3 priorities ranked by urgency and impact', 'Calendar conflicts and focus-block recommendations', 'Urgent email summaries with suggested replies', 'Upcoming deadlines and delegated follow-ups'].map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-ink-line bg-ink-card/50 p-3 text-sm text-chalk">
                  <ShieldCheck size={17} className="text-gold-light shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="architecture" className="max-w-7xl mx-auto px-4 sm:px-6 mt-10">
        <SectionHeading eyebrow="Architecture" title="Three layers: context, judgment, execution" blurb="The assistant is designed as a modular AI operator, not a reactive chatbot." />
        <div className="grid lg:grid-cols-3 gap-5">
          {layers.map(({ title, description, items, icon: Icon }) => (
            <article key={title} className="glass card-pad-lg">
              <Icon className="text-gold-light mb-4" size={26} />
              <h3 className="section-title">{title}</h3>
              <p className="text-mist text-sm leading-relaxed mt-2">{description}</p>
              <ul className="mt-5 space-y-2">
                {items.map((item) => <li key={item} className="text-sm text-chalk flex gap-2"><CheckCircle2 size={15} className="text-electric-glow mt-0.5 shrink-0" />{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24">
        <SectionHeading eyebrow="Capabilities" title="Built like an executive assistant" blurb="Each module supports proactive recommendations plus user-approved execution through connected tools." />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass card-pad">
              <Icon size={22} className="text-electric-glow mb-3" />
              <h3 className="font-semibold text-paper">{title}</h3>
              <p className="text-sm text-mist leading-relaxed mt-2">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24">
        <div className="glass-strong rounded-3xl p-8 sm:p-12 grid lg:grid-cols-2 gap-10">
          <div>
            <div className="eyebrow mb-3">Multi-agent upgrade</div>
            <h2 className="display-title text-paper">A 3-agent operating system for productivity</h2>
            <p className="mt-4 text-mist leading-relaxed">The strongest version splits responsibilities into specialized agents with shared memory, audit logs, and clear approval gates before any external action is taken.</p>
          </div>
          <div className="space-y-3">
            {agents.map((agent) => <div key={agent} className="glass card-pad text-chalk text-sm">{agent}</div>)}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24 mb-24">
        <SectionHeading eyebrow="Backend design" title="Core data model" blurb="A practical starting schema for building the assistant with React, Next.js, Node.js, Python AI services, and integrations." />
        <div className="overflow-hidden rounded-2xl border border-ink-line">
          <table className="w-full text-sm">
            <tbody>
              {schemaRows.map(([table, purpose]) => (
                <tr key={table} className="border-b border-ink-line last:border-b-0 bg-ink-card/40">
                  <th className="text-left text-gold-light font-semibold p-4 align-top w-52">{table}</th>
                  <td className="text-chalk p-4">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}
