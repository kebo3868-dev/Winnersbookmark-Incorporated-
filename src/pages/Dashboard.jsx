import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
  MailCheck,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import Layout from '../components/Layout';

const agentCards = [
  {
    icon: CalendarCheck,
    title: 'Scheduler AI',
    text: 'Optimizes calendars, protects deep-work blocks, detects conflicts, and recommends smarter meeting windows.',
  },
  {
    icon: MailCheck,
    title: 'Communication AI',
    text: 'Summarizes email, drafts executive replies, identifies urgent messages, and turns threads into tasks.',
  },
  {
    icon: BrainCircuit,
    title: 'Strategy AI',
    text: 'Ranks priorities, spots delegation opportunities, creates daily briefings, and keeps operators focused.',
  },
];

const capabilities = [
  'Google Calendar scheduling and conflict detection',
  'Gmail summaries, reply drafts, and task extraction',
  'Smart priority system for high, medium, low, and delegatable work',
  'Daily briefings with schedule, top priorities, urgent emails, and deadlines',
  'Meeting prep briefs with participants, talking points, and previous notes',
  'Voice-command interface for hands-free executive operations',
];

const process = [
  { step: '01', title: 'Map the operation', text: 'We document your calendar flow, email load, decision points, tools, and weekly bottlenecks.' },
  { step: '02', title: 'Design the secretary brain', text: 'We configure Winnersbookmark into modular Scheduler, Communication, and Strategy AI workflows.' },
  { step: '03', title: 'Connect the stack', text: 'We prepare integrations for Google Calendar, Gmail, Slack, Notion, and automation platforms.' },
  { step: '04', title: 'Launch with guardrails', text: 'We deploy dashboards, approvals, reporting, and escalation rules so the assistant operates professionally.' },
];

const integrations = ['Google Calendar', 'Gmail', 'Slack', 'Notion', 'Zapier', 'Voice Commands'];

export default function Dashboard() {
  return (
    <Layout>
      <main className="agency-page">
        <section className="relative overflow-hidden rounded-[2rem] border border-ink-edge bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-electric/10 px-5 py-10 shadow-panel-lg sm:px-10 sm:py-14">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-electric/25 blur-3xl" />
          <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-gold/15 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
            <div>
              <div className="eyebrow mb-4">Winnersbookmark Agency</div>
              <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tight text-paper sm:text-6xl lg:text-7xl">
                Your AI chief-of-staff for
                <span className="text-gradient-gold"> founders, creators,</span> and operators.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-chalk sm:text-lg">
                Winnersbookmark Agency builds premium virtual secretary systems that protect your time, organize your work, and automate the administrative weight that slows high-performance businesses down.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#contact" className="btn-gold">
                  Build my AI Secretary <ArrowRight size={18} />
                </a>
                <a href="#system" className="btn-ghost">
                  Explore the system <Bot size={18} />
                </a>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
                <Metric value="3" label="Core AI agents" />
                <Metric value="24/7" label="Ops support vision" />
                <Metric value="6+" label="Key integrations" />
              </div>
            </div>

            <div className="glass-strong card-pad-lg accent-top">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="eyebrow">Today’s briefing</div>
                  <h2 className="mt-1 font-display text-2xl font-bold text-paper">Executive Control Center</h2>
                </div>
                <div className="rounded-2xl border border-gold/30 bg-gold/10 p-3 text-gold-light">
                  <Sparkles size={24} />
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <BriefingRow icon={Clock3} title="Focus protection" text="Move two low-priority calls to preserve a 2-hour strategy block." />
                <BriefingRow icon={MailCheck} title="Urgent inbox" text="Three client messages need approval-ready replies before noon." />
                <BriefingRow icon={Target} title="Top priority" text="Finalize launch assets and delegate recurring admin tasks." />
              </div>
              <div className="divider" />
              <div className="rounded-2xl border border-electric/30 bg-electric/10 p-4">
                <p className="text-sm leading-6 text-chalk">
                  “Your calendar is overbooked on Thursday. Would you like me to move two meetings to Friday to preserve focus time?”
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="system" className="section-block">
          <SectionIntro eyebrow="The system" title="A modular AI operator, not just another chatbot." text="Winnersbookmark functions across information, decision, and execution layers so your assistant can understand context, recommend priorities, and trigger the work." />
          <div className="grid gap-4 md:grid-cols-3">
            {agentCards.map(({ icon: Icon, title, text }) => (
              <article key={title} className="glass card-pad accent-top">
                <div className="mb-5 inline-flex rounded-2xl border border-gold/30 bg-gold/10 p-3 text-gold-light"><Icon size={24} /></div>
                <h3 className="font-display text-xl font-bold text-paper">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-mist">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <SectionIntro eyebrow="Capabilities" title="Built around the exact workflows busy executives need daily." text="The agency implementation focuses on practical automation: scheduling, email, task prioritization, meeting preparation, notes, and voice-driven commands." />
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-ink-line bg-ink-card/50 p-4">
                <CheckCircle2 className="mt-0.5 shrink-0 text-gold-light" size={18} />
                <p className="text-sm leading-6 text-chalk">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-block">
          <SectionIntro eyebrow="Agency method" title="From raw operations to a working AI secretary stack." text="We turn the Winnersbookmark vision into a clean, professional dashboard and automation plan that can grow into a fully operational executive assistant." />
          <div className="grid gap-4 md:grid-cols-4">
            {process.map((item) => (
              <article key={item.step} className="glass card-pad">
                <div className="text-gradient-electric font-display text-3xl font-black">{item.step}</div>
                <h3 className="mt-3 font-display text-lg font-bold text-paper">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-mist">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block grid gap-6 lg:grid-cols-2">
          <div className="glass-strong card-pad-lg accent-top">
            <Network className="mb-4 text-electric-glow" size={28} />
            <h2 className="font-display text-3xl font-bold text-paper">Connected to your business tools.</h2>
            <p className="mt-3 text-sm leading-6 text-mist">Winnersbookmark Agency designs the assistant around the tools entrepreneurs already use, then layers approvals and automations on top.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {integrations.map((item) => <span key={item} className="chip-blue">{item}</span>)}
            </div>
          </div>
          <div id="contact" className="glass-strong card-pad-lg accent-top">
            <ShieldCheck className="mb-4 text-gold-light" size={28} />
            <h2 className="font-display text-3xl font-bold text-paper">Ready to build Bill Opal as Winnersbookmark?</h2>
            <p className="mt-3 text-sm leading-6 text-mist">Start with an AI secretary blueprint, then expand into phone answering, travel booking, expense tracking, meeting summaries, and business-wide automation.</p>
            <Link to="/master" className="btn-primary mt-6">
              View build prompts <FileText size={18} />
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}

function Metric({ value, label }) {
  return (
    <div className="rounded-2xl border border-ink-line bg-ink-card/50 p-4">
      <div className="font-display text-2xl font-black text-paper">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-mist">{label}</div>
    </div>
  );
}

function BriefingRow({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-ink-line bg-ink-card/50 p-4">
      <div className="rounded-xl border border-electric/30 bg-electric/10 p-2 text-electric-glow"><Icon size={18} /></div>
      <div>
        <div className="font-semibold text-paper">{title}</div>
        <p className="mt-1 text-sm leading-6 text-mist">{text}</p>
      </div>
    </div>
  );
}

function SectionIntro({ eyebrow, title, text }) {
  return (
    <div className="mb-6 max-w-3xl">
      <div className="eyebrow mb-3">{eyebrow}</div>
      <h2 className="font-display text-3xl font-bold leading-tight text-paper sm:text-4xl">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-mist sm:text-base">{text}</p>
    </div>
  );
}
