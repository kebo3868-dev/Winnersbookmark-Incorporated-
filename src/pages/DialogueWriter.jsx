import { useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import PromptCard from '../components/PromptCard';
import { Field } from '../components/Field';
import { MessageSquare, Wand2 } from 'lucide-react';

const TYPES = [
  { id: 'speech',    label: 'Character speech' },
  { id: 'narration', label: 'Narration box' },
  { id: 'inner',     label: 'Inner monologue' },
  { id: 'villain',   label: 'Villain line' },
  { id: 'banter',    label: 'Funny banter' },
  { id: 'emotional', label: 'Emotional dialogue' },
  { id: 'action',    label: 'Action scene line' },
  { id: 'caption',   label: 'Short readable caption' },
];

const RULES = [
  'Keep text short — a balloon ≈ 25 words max.',
  'Each character should sound unique. Read it aloud.',
  'Use subtext — don’t say what the character feels, show it.',
  'Avoid exposition dumps. Move it to a caption box if needed.',
  'Speech bubbles must read at thumbnail size.',
  'Match tone and genre — noir cuts short, fantasy ornaments more.',
];

export default function DialogueWriter() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const [scene, setScene] = useState('');
  const [tone, setTone]   = useState('');
  const [type, setType]   = useState('speech');
  const [chars, setChars] = useState('');

  const prompt = [
    `Act as a senior comic writer.`,
    `Project: "${project.title}" (${project.genre || ''} · ${project.style || ''}).`,
    `Characters in scene: ${chars || (project.characters || []).map(c => c.name).filter(Boolean).join(', ') || 'main cast'}.`,
    `Scene beat: ${scene || '[scene description]'}.`,
    `Type of line wanted: ${(TYPES.find(t => t.id === type) || TYPES[0]).label}.`,
    `Tone: ${tone || project.tone || 'cinematic'}.`,
    ``,
    `Write 5 candidate lines. Keep each under 25 words. No quotation marks. Mark speaker in ALL CAPS followed by colon. End list with the strongest pick labeled "BEST:".`,
  ].join('\n');

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Dialogue Writer"
          title="Make every panel speak"
          subtitle="Generate balloons, captions, narration, and inner monologue that sound like the character — not the writer."
        />

        <div className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">Scene</div>
          <div className="field-row mb-3">
            <Field label="Type of line">
              <select value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Tone">
              <input value={tone} onChange={e => setTone(e.target.value)} placeholder="Cold, defiant, comic, brittle…" />
            </Field>
          </div>
          <Field label="Characters in the scene">
            <input value={chars} onChange={e => setChars(e.target.value)} placeholder="Aaron, The Director" />
          </Field>
          <Field label="Scene beat" hint="What is the moment? What just happened? What does the speaker want?">
            <textarea value={scene} onChange={e => setScene(e.target.value)}
              placeholder="Aaron has just survived a fall that should have killed him. He’s alone on the roof. He looks down at his hands." />
          </Field>
        </div>

        <PromptCard
          eyebrow="Dialogue AI Prompt"
          title="Paste to ChatGPT / Claude / Gemini"
          prompt={prompt}
          accent="electric"
          actions={<span className="chip-blue"><Wand2 size={11}/> 5 candidates</span>}
        />

        <div className="glass card-pad mt-6">
          <div className="eyebrow mb-2 flex items-center gap-2"><MessageSquare size={12}/> Dialogue rules</div>
          <ul className="space-y-1.5 text-sm text-chalk">
            {RULES.map(r => <li key={r} className="flex gap-2"><span className="text-gold">▸</span>{r}</li>)}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
