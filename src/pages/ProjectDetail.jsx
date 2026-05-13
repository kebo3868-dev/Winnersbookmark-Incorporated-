import { Link } from 'react-router-dom';
import {
  BookOpen, Users, Globe2, Layers, BookCopy, MessageSquare, Image as ImageIcon,
  ListChecks, Share2, DollarSign, Download, Clapperboard, ArrowRight,
  CheckCircle2, Circle,
} from 'lucide-react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import ProgressRing from '../components/ProgressRing';
import { useStudio, projectProgress } from '../context/StudioContext';
import { Field } from '../components/Field';
import { AUDIENCES, TONES } from '../data/options';
import { GENRES } from '../data/genres';
import { STYLES } from '../data/styles';
import { formatDate } from '../lib/ids';

const MODULES = (id) => ([
  { to: `/project/${id}/story`,      icon: BookOpen,       label: 'Story Engine',    desc: 'Logline, arcs, twist, ending' },
  { to: `/project/${id}/characters`, icon: Users,          label: 'Character Vault', desc: 'Cast bible with consistency notes' },
  { to: `/project/${id}/world`,      icon: Globe2,         label: 'World Builder',   desc: 'Location, rules, mood, palette' },
  { to: `/project/${id}/pages`,      icon: Layers,         label: 'Page Builder',    desc: 'Panel-by-panel pages' },
  { to: `/project/${id}/prompts`,    icon: ImageIcon,      label: 'Panel Prompts',   desc: 'Per-panel image generation' },
  { to: `/project/${id}/cover`,      icon: BookCopy,       label: 'Cover Creator',   desc: 'Cinematic cover & blurb' },
  { to: `/project/${id}/dialogue`,   icon: MessageSquare,  label: 'Dialogue Writer', desc: 'Lines, captions, narration' },
  { to: `/project/${id}/storyboard`, icon: Clapperboard,   label: 'Storyboard View', desc: 'Pages at a glance' },
  { to: `/project/${id}/continuity`, icon: ListChecks,     label: 'Continuity',      desc: 'Auto-flag inconsistencies' },
  { to: `/project/${id}/social`,     icon: Share2,         label: 'Social Kit',      desc: 'TikTok, IG, YT, captions' },
  { to: `/project/${id}/monetize`,   icon: DollarSign,     label: 'Monetization',    desc: 'Sell, license, publish' },
  { to: `/project/${id}/export`,     icon: Download,       label: 'Export Center',   desc: 'Script, JSON, Markdown' },
]);

export default function ProjectDetail() {
  return (
    <ProjectGuard>
      {({ project }) => <Inner project={project} />}
    </ProjectGuard>
  );
}

function Inner({ project }) {
  const { updateActive } = useStudio();
  const onPatch = (patch) => updateActive(patch);

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Project"
          title={project.title || 'Untitled Comic'}
          subtitle={project.logline || 'No logline yet — open the Story Engine to forge one.'}
          right={<ProgressRing value={projectProgress(project)} label="ready" />}
        />

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="chip-gold">{project.genre || 'no genre'}</span>
          <span className="chip-blue">{project.style || 'no style'}</span>
          <span className="chip">{project.audience || 'no audience'}</span>
          <span className="chip">{project.tone || 'no tone'}</span>
          <span className="chip">{project.pages || 0} pages</span>
          <span className="chip">{project.panelsPerPage || 0} panels/page</span>
          <span className="chip">Updated {formatDate(project.updatedAt)}</span>
        </div>

        {/* Quick edit core fields */}
        <section className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">Core</div>
          <div className="field-row mb-3">
            <Field label="Title">
              <input value={project.title} onChange={e => onPatch({ title: e.target.value })} />
            </Field>
            <Field label="Genre">
              <select value={project.genre} onChange={e => onPatch({ genre: e.target.value })}>
                <option value="">Choose</option>
                {GENRES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="Visual style">
              <select value={project.style} onChange={e => onPatch({ style: e.target.value })}>
                <option value="">Choose</option>
                {STYLES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Audience">
              <select value={project.audience} onChange={e => onPatch({ audience: e.target.value })}>
                <option value="">Choose</option>
                {AUDIENCES.map(a => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Tone">
              <select value={project.tone} onChange={e => onPatch({ tone: e.target.value })}>
                <option value="">Choose</option>
                {TONES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Pages">
              <input type="number" min="1" max="200"
                value={project.pages || 0}
                onChange={e => onPatch({ pages: Math.max(1, parseInt(e.target.value || '1')) })} />
            </Field>
          </div>
          <Field label="Logline (one sentence pitch)">
            <textarea value={project.logline} onChange={e => onPatch({ logline: e.target.value })}
              placeholder="An ordinary kid from a forgotten neighborhood inherits a power that the city’s shadow rulers will kill to recover." />
          </Field>
        </section>

        {/* Modules */}
        <PageHeader eyebrow="Studio Modules" title="Build the legend" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {MODULES(project.id).map(m => (
            <Link key={m.to} to={m.to} className="glass card-pad hover:border-gold/40 transition-colors group">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-ink-card2 border border-ink-line text-chalk flex items-center justify-center shrink-0">
                  <m.icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold text-paper">{m.label}</div>
                  <div className="text-mist text-xs mt-0.5">{m.desc}</div>
                </div>
                <ArrowRight size={14} className="text-mist group-hover:text-paper transition-colors mt-1" />
              </div>
            </Link>
          ))}
        </div>

        {/* Publishing checklist */}
        <PageHeader eyebrow="Launch" title="Publishing Checklist" />
        <div className="glass card-pad">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5">
            {(project.publishingChecklist || []).map((c, i) => (
              <li key={c.label}>
                <button
                  type="button"
                  onClick={() => {
                    const next = project.publishingChecklist.map((x, idx) => idx === i ? { ...x, done: !x.done } : x);
                    onPatch({ publishingChecklist: next });
                  }}
                  className="flex items-center gap-2.5 text-left w-full py-1.5 rounded-lg hover:bg-white/[0.03]"
                >
                  {c.done
                    ? <CheckCircle2 size={16} className="text-gold-light shrink-0" />
                    : <Circle size={16} className="text-ghost shrink-0" />}
                  <span className={`text-sm ${c.done ? 'text-paper line-through decoration-gold/50' : 'text-chalk'}`}>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
