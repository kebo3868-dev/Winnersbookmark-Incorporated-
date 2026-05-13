import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import PromptCard from '../components/PromptCard';
import { Field } from '../components/Field';
import { AI_TOOLS } from '../data/aiTools';
import { useStudio } from '../context/StudioContext';
import { masterPromptForTool, panelPrompt, characterBibleLine } from '../lib/prompts';
import { Wand2 } from 'lucide-react';

const KINDS = [
  { id: 'panel',    label: 'Panel image' },
  { id: 'cover',    label: 'Cover image' },
  { id: 'logline',  label: 'Logline brainstorm' },
  { id: 'script',   label: 'Full script (text)' },
  { id: 'video',    label: 'Animate a panel (video)' },
];

export default function MasterPrompts() {
  const { projects, activeProject } = useStudio();
  const [projectId, setProjectId] = useState(activeProject?.id || projects[0]?.id || '');
  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  const [tool, setTool] = useState('midjourney');
  const [kind, setKind] = useState('panel');
  const [brief, setBrief] = useState('');
  const [text, setText]   = useState('');
  const [ar, setAr]       = useState('2:3');
  const [camera, setCamera] = useState('slow push-in');

  const baseImagePrompt = project
    ? panelPrompt({
        style: project.style,
        action: brief || 'a defining hero moment',
        setting: project.setting || project.world?.location,
        cameraAngle: 'medium hero shot',
        lighting: 'cinematic key + rim',
        emotion: project.tone || 'cinematic',
        palette: project.world?.palette,
        characterBible: characterBibleLine(project.characters?.[0]),
      })
    : '';

  const generated = useMemo(() => masterPromptForTool({
    tool,
    project,
    kind,
    payload: {
      brief,
      image: kind === 'panel' || kind === 'cover' || kind === 'video' ? baseImagePrompt : undefined,
      text,
      ar,
      camera,
    },
  }), [tool, project, kind, brief, baseImagePrompt, text, ar, camera]);

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="AI Master Prompt Builder"
          title="One brief. Every tool."
          subtitle="Generate platform-optimized prompts for ChatGPT, Claude, Gemini, Midjourney, Leonardo, Ideogram, DALL·E, Runway, Pika, Kling, Veo, Canva, and Photoshop."
        />

        {/* Tool selector */}
        <div className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">Tool</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {AI_TOOLS.map(t => (
              <button
                key={t.id} onClick={() => setTool(t.id)}
                className={`p-2.5 rounded-xl border text-center transition-all active:scale-[.98] ${
                  tool === t.id ? 'border-gold bg-gold/10 shadow-gold' : 'border-ink-line bg-ink-card/60 hover:border-electric/60'
                }`}
              >
                <div className={`text-[10px] uppercase tracking-wider mb-0.5 ${tool === t.id ? 'text-gold-light' : 'text-mist'}`}>{t.kind}</div>
                <div className={`text-sm font-semibold ${tool === t.id ? 'text-gold-light' : 'text-paper'}`}>{t.name}</div>
              </button>
            ))}
          </div>
          <p className="text-mist text-xs mt-3">{AI_TOOLS.find(t => t.id === tool)?.description}</p>
        </div>

        {/* Brief */}
        <div className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">Brief</div>
          <div className="field-row mb-3">
            <Field label="Project">
              <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">— None / generic —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="Kind of output">
              <select value={kind} onChange={e => setKind(e.target.value)}>
                {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="What is the moment?" hint="One or two lines. The studio fills in style, character bible, and world from the project.">
            <textarea value={brief} onChange={e => setBrief(e.target.value)}
              placeholder="Aaron steps off the ledge — and the city sees him not fall." />
          </Field>

          {kind === 'video' && (
            <div className="field-row mt-3">
              <Field label="Camera move">
                <input value={camera} onChange={e => setCamera(e.target.value)} placeholder="Slow push-in, parallax, handheld…" />
              </Field>
              <Field label="Aspect ratio">
                <input value={ar} onChange={e => setAr(e.target.value)} placeholder="16:9, 9:16, 1:1" />
              </Field>
            </div>
          )}

          {tool === 'ideogram' && (
            <Field label="Text to render (Ideogram only)">
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Exact letters Ideogram should render in the image" />
            </Field>
          )}
        </div>

        <PromptCard
          eyebrow={`${(AI_TOOLS.find(t=>t.id===tool)?.name) || 'Tool'} prompt`}
          title="Platform-optimized prompt"
          prompt={generated}
          accent="gold"
          actions={<span className="chip-gold"><Wand2 size={11}/> Optimized</span>}
        />
      </div>
    </Layout>
  );
}
