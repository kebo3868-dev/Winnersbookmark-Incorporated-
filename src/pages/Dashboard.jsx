import { Link } from 'react-router-dom';
import {
  Sparkles, BookOpen, Users, Globe2, Layers, BookCopy, Wand2, Image as ImageIcon,
  Download, MessageSquare, ListChecks, Share2, DollarSign, ArrowRight, PlayCircle,
  PenTool, Clapperboard,
} from 'lucide-react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProgressRing from '../components/ProgressRing';
import { useStudio, projectProgress } from '../context/StudioContext';
import { formatDate } from '../lib/ids';
import { TEMPLATES } from '../data/templates';

const QUICK_TILES = [
  { to: '/new',             label: 'AI Comic Builder',  desc: 'Wizard-guided new project',     icon: Sparkles, accent: 'gold' },
  { to: '/templates',       label: 'Quick Templates',   desc: '12 prebuilt story starters',    icon: BookCopy, accent: 'blue' },
  { to: '/master',          label: 'Master Prompts',    desc: 'Per-tool platform prompts',     icon: Wand2,    accent: 'gold' },
];

const PROJECT_MODULES = (id) => ([
  { to: `/project/${id}/story`,      icon: BookOpen,    label: 'Story Engine' },
  { to: `/project/${id}/characters`, icon: Users,       label: 'Character Vault' },
  { to: `/project/${id}/world`,      icon: Globe2,      label: 'World Builder' },
  { to: `/project/${id}/pages`,      icon: Layers,      label: 'Page Builder' },
  { to: `/project/${id}/prompts`,    icon: ImageIcon,   label: 'Panel Prompts' },
  { to: `/project/${id}/cover`,      icon: BookCopy,    label: 'Cover Creator' },
  { to: `/project/${id}/dialogue`,   icon: MessageSquare, label: 'Dialogue Writer' },
  { to: `/project/${id}/storyboard`, icon: Clapperboard, label: 'Storyboard View' },
  { to: `/project/${id}/continuity`, icon: ListChecks,  label: 'Continuity Check' },
  { to: `/project/${id}/social`,     icon: Share2,      label: 'Social Kit' },
  { to: `/project/${id}/monetize`,   icon: DollarSign,  label: 'Monetization' },
  { to: `/project/${id}/export`,     icon: Download,    label: 'Export Center' },
]);

export default function Dashboard() {
  const { projects, activeProject, createProject } = useStudio();

  const recents = [...projects].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 4);
  const active = activeProject || recents[0];

  return (
    <Layout>
      <div className="page">
        {/* Hero */}
        <section className="glass-strong card-pad-lg accent-top relative overflow-hidden mb-7">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-electric/15 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="eyebrow mb-3">Winnersbookmark CineComic Studio</div>
            <h1 className="hero-title">
              Build the story.<br/>
              <span className="text-gradient-gold">Design the world.</span><br/>
              <span className="text-gradient-electric">Publish the legend.</span>
            </h1>
            <p className="text-chalk mt-4 max-w-prose text-sm sm:text-base">
              A premium AI-assisted comic book, graphic novel, manga, and storyboard studio.
              Take a raw idea from logline to publish-ready outline — characters, panels, cover, and prompts.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link to="/new" className="btn-gold"><Sparkles size={16} /> Start a Comic</Link>
              <Link to="/templates" className="btn-ghost"><BookCopy size={16} /> Browse Templates</Link>
              <Link to="/master" className="btn-ghost"><Wand2 size={16} /> Master Prompts</Link>
            </div>
          </div>
        </section>

        {/* Quick start tiles */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
          {QUICK_TILES.map(t => (
            <Link
              key={t.to} to={t.to}
              className={`glass card-pad accent-top group hover:shadow-panel-lg transition-all border-${t.accent === 'gold' ? 'gold' : 'electric'}/30`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.accent === 'gold' ? 'bg-gold/10 text-gold-light border border-gold/30' : 'bg-electric/10 text-electric-glow border border-electric/30'}`}>
                  <t.icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold text-paper">{t.label}</div>
                  <div className="text-[12px] text-mist">{t.desc}</div>
                </div>
                <ArrowRight size={16} className="ml-auto text-mist group-hover:text-paper transition-colors" />
              </div>
            </Link>
          ))}
        </section>

        {/* Active project + progress */}
        {active && (
          <section className="mb-7">
            <PageHeader eyebrow="Now in production" title="Project Progress Tracker" />
            <div className="glass card-pad-lg accent-top">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="eyebrow mb-1">{active.genre || 'Untitled genre'} · {active.style || 'no style'}</div>
                  <h2 className="font-display font-bold text-2xl text-paper truncate">{active.title}</h2>
                  <p className="text-mist text-sm mt-1 line-clamp-2">{active.logline || 'No logline yet — start in Story Engine.'}</p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <span className="chip-gold">{active.pages || 0} pages</span>
                    <span className="chip">{(active.characters || []).length} characters</span>
                    <span className="chip">{(active.pagesList || []).reduce((s,p) => s + (p.panels?.length || 0), 0)} panels</span>
                    <span className="chip">Updated {formatDate(active.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ProgressRing value={projectProgress(active)} label="ready" />
                  <Link to={`/project/${active.id}`} className="btn-primary text-sm h-9 px-3"><PlayCircle size={14} /> Open</Link>
                </div>
              </div>
              <div className="divider" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PROJECT_MODULES(active.id).map(m => (
                  <Link key={m.to} to={m.to} className="glass card-pad hover:border-gold/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-ink-card2 border border-ink-line flex items-center justify-center text-chalk"><m.icon size={15} /></div>
                      <div className="text-sm font-medium text-paper truncate">{m.label}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Recent projects */}
        <section className="mb-7">
          <PageHeader eyebrow="Library" title="Recent Projects"
            right={<Link to="/projects" className="btn-ghost text-sm">View all <ArrowRight size={14} /></Link>}
          />
          {recents.length === 0 ? (
            <div className="empty">
              <div className="font-display text-xl font-semibold text-paper">No projects yet</div>
              <p className="text-mist text-sm mt-1.5">Start your first cinematic comic in under a minute.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link to="/new" className="btn-gold"><Sparkles size={16} /> New Comic</Link>
                <button className="btn-ghost" onClick={() => {
                  const p = createProject({ title: 'My First Comic', genre: 'superhero', style: 'us-superhero', audience: 'Teen (13–17)' });
                  window.location.href = `/project/${p.id}`;
                }}><PenTool size={16} /> Quick start</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recents.map(p => (
                <Link key={p.id} to={`/project/${p.id}`} className="glass card-pad hover:border-gold/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="eyebrow mb-1">{p.genre || '—'} · {p.style || '—'}</div>
                      <div className="font-display font-semibold text-paper text-lg truncate">{p.title}</div>
                      <div className="text-mist text-xs mt-1 line-clamp-2">{p.logline || 'No logline yet.'}</div>
                    </div>
                    <ProgressRing value={projectProgress(p)} size={52} stroke={5} />
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <span className="chip">{(p.characters || []).length} chars</span>
                    <span className="chip">{(p.pagesList || []).length} pages</span>
                    <span className="chip">{formatDate(p.updatedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Spark / Templates */}
        <section className="mb-7">
          <PageHeader eyebrow="Spark" title="Quick Start Templates" subtitle="Pre-built starters to spawn your next legend." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.slice(0, 4).map(t => (
              <Link key={t.id} to={`/templates?spawn=${t.id}`} className="glass card-pad hover:border-electric/40 transition-colors">
                <div className="eyebrow mb-1">{t.genre} · {t.tone}</div>
                <div className="font-display font-semibold text-paper">{t.title}</div>
                <p className="text-mist text-[12.5px] mt-1 line-clamp-2">{t.logline}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
