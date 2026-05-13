import { BookOpen, Sparkles } from 'lucide-react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import { Field } from '../components/Field';
import { useStudio } from '../context/StudioContext';
import { FRAMEWORKS } from '../data/frameworks';
import PromptCard from '../components/PromptCard';
import { describeProject } from '../lib/prompts';

export default function StoryEngine() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

const FIELDS = [
  { k: 'logline',             label: 'Logline',              hint: 'A single sentence that pitches the entire story.' },
  { k: 'premise',             label: 'Main Premise',         hint: 'The promise of the comic in 2–3 sentences.' },
  { k: 'heroJourney',         label: 'Hero’s Journey',   hint: 'The protagonist’s transformation arc.' },
  { k: 'villainMotivation',   label: 'Villain Motivation',   hint: 'Why does the antagonist do what they do?' },
  { k: 'supportingCharacters',label: 'Supporting Characters',hint: 'Allies, mentors, rivals, foils.' },
  { k: 'conflict',            label: 'Central Conflict',     hint: 'What forces collide?' },
  { k: 'stakes',              label: 'Stakes',               hint: 'What is lost if the hero fails?' },
  { k: 'emotionalArc',        label: 'Emotional Arc',        hint: 'The emotional curve the reader follows.' },
  { k: 'plotTwist',           label: 'Plot Twist',           hint: 'The surprise that recontextualizes act 2.' },
  { k: 'ending',              label: 'Ending',               hint: 'How does the climax resolve?' },
  { k: 'sequelHook',          label: 'Sequel Hook',          hint: 'A final beat that sets up the next issue.' },
];

function Inner({ project }) {
  const { updateActive } = useStudio();
  const onPatch = (patch) => updateActive(patch);

  const fw = FRAMEWORKS.find(f => f.id === (project.framework || 'three-act')) || FRAMEWORKS[0];

  const buildAIPrompt = () => [
    `Act as a senior comic book writer and editor.`,
    `Project: ${describeProject(project)}`,
    `Audience: ${project.audience || '—'}. Tone: ${project.tone || '—'}.`,
    `Main character: ${project.mainCharacter || '—'}. Villain: ${project.villain || '—'}.`,
    `Setting: ${project.setting || '—'}. Story goal: ${project.storyGoal || '—'}.`,
    ``,
    `Use the ${fw.name} framework. For each beat below, write 1–2 punchy lines that read like a comic editor’s notes:`,
    ...fw.beats.map(b => `- ${b.label}:`),
    ``,
    `Then return: a single-sentence logline, a 3-sentence premise, the villain’s motivation, central conflict, stakes, emotional arc, plot twist, ending, and a sequel hook.`,
  ].join('\n');

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Story Engine"
          title="Forge the spine of the story"
          subtitle="Lock the logline, arcs, twist, and cliffhanger. The rest of the studio reads from here."
        />

        {/* Framework selector */}
        <div className="glass card-pad-lg accent-top mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="eyebrow">Framework</div>
            <select value={project.framework || 'three-act'} onChange={e => onPatch({ framework: e.target.value })} className="!w-auto !py-2">
              {FRAMEWORKS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fw.beats.map(b => (
              <Field key={b.id} label={b.label}>
                <textarea
                  value={project.beats?.[b.id] || ''}
                  onChange={e => onPatch({ beats: { ...(project.beats || {}), [b.id]: e.target.value } })}
                  placeholder={`Write the ${b.label} beat…`}
                />
              </Field>
            ))}
          </div>
        </div>

        {/* Core story fields */}
        <div className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">Story Spine</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map(f => (
              <Field key={f.k} label={f.label} hint={f.hint}>
                {f.k === 'logline'
                  ? <input value={project[f.k] || ''} onChange={e => onPatch({ [f.k]: e.target.value })} />
                  : <textarea value={project[f.k] || ''} onChange={e => onPatch({ [f.k]: e.target.value })} />}
              </Field>
            ))}
          </div>
        </div>

        {/* AI Prompt to expand the story */}
        <PromptCard
          eyebrow="Story Engine — AI Prompt"
          title="Expand the story with any LLM"
          prompt={buildAIPrompt()}
          accent="gold"
          actions={<span className="chip-gold"><Sparkles size={11}/> {fw.name}</span>}
        >
          <p className="text-mist text-xs mt-3 flex items-center gap-2">
            <BookOpen size={13} /> Paste this into ChatGPT, Claude, or Gemini to draft the full beat sheet. Copy results back into the fields above.
          </p>
        </PromptCard>
      </div>
    </Layout>
  );
}
