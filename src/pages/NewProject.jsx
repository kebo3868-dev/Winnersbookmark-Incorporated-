import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Wand2 } from 'lucide-react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import SelectGrid from '../components/SelectGrid';
import { Field } from '../components/Field';
import { useStudio } from '../context/StudioContext';
import { GENRES } from '../data/genres';
import { STYLES } from '../data/styles';
import { AUDIENCES, TONES, PAGE_FORMATS } from '../data/options';

const STEPS = ['Concept', 'Genre', 'Style', 'Format', 'Cast & World', 'Goal'];

export default function NewProject() {
  const nav = useNavigate();
  const { createProject } = useStudio();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    title: '', audience: '', tone: '',
    genre: '', style: '',
    format: '8pg', pages: 8, panelsPerPage: 5,
    mainCharacter: '', villain: '', setting: '',
    storyGoal: '', visualStyle: '',
  });

  const update = (patch) => setDraft(d => ({ ...d, ...patch }));

  const valid = useMemo(() => ({
    0: !!draft.title.trim(),
    1: !!draft.genre,
    2: !!draft.style,
    3: !!draft.format,
    4: true,
    5: true,
  }), [draft]);

  const submit = () => {
    const fmt = PAGE_FORMATS.find(f => f.id === draft.format) || PAGE_FORMATS[2];
    const project = {
      ...draft,
      pages: fmt.pages,
      panelsPerPage: fmt.panelsPerPage,
    };
    delete project.format;
    const p = createProject(project);
    nav(`/project/${p.id}`);
  };

  const onNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else submit();
  };

  return (
    <Layout>
      <div className="page max-w-2xl">
        <PageHeader
          eyebrow="New Comic Project"
          title="Spin up a cinematic comic"
          subtitle="Six quick steps. Every choice flows into the rest of the studio."
        />

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto scrollbar-hide">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <button
                type="button" onClick={() => setStep(i)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  i === step ? 'bg-gold/15 text-gold-light border border-gold/40'
                  : i < step ? 'text-paper border border-ink-edge bg-ink-card/60'
                  : 'text-mist border border-ink-line bg-ink-card/40'
                }`}
              >
                {i + 1}. {s}
              </button>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-ink-line" />}
            </div>
          ))}
        </div>

        <div className="glass card-pad-lg accent-top slide-up">
          {step === 0 && (
            <div className="space-y-4">
              <div className="eyebrow">Step 1 of 6 — Concept</div>
              <Field label="Project title">
                <input value={draft.title} onChange={e => update({ title: e.target.value })} placeholder="e.g., NEW DETROIT: VAULT" />
              </Field>
              <div className="field-row">
                <Field label="Audience">
                  <select value={draft.audience} onChange={e => update({ audience: e.target.value })}>
                    <option value="">Choose audience</option>
                    {AUDIENCES.map(a => <option key={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="Tone">
                  <select value={draft.tone} onChange={e => update({ tone: e.target.value })}>
                    <option value="">Choose tone</option>
                    {TONES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="eyebrow">Step 2 of 6 — Genre</div>
              <SelectGrid items={GENRES} value={draft.genre} onChange={(id) => update({ genre: id })} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="eyebrow">Step 3 of 6 — Visual Style</div>
              <p className="text-mist text-sm">Each style drives a different image-prompt structure across the studio.</p>
              <SelectGrid items={STYLES} value={draft.style} onChange={(id) => update({ style: id })} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="eyebrow">Step 4 of 6 — Format</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PAGE_FORMATS.map(f => (
                  <button
                    key={f.id} type="button" onClick={() => update({ format: f.id })}
                    className={`text-left p-3 rounded-xl border transition-all active:scale-[.98] ${
                      draft.format === f.id ? 'border-gold bg-gold/10 shadow-gold' : 'border-ink-line bg-ink-card/60 hover:border-electric/60'
                    }`}
                  >
                    <div className="font-display font-semibold text-paper">{f.label}</div>
                    <div className="text-[12px] text-mist mt-0.5">{f.pages} pages · {f.panelsPerPage} panels/page</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="eyebrow">Step 5 of 6 — Cast & World</div>
              <Field label="Main character (one line)">
                <input value={draft.mainCharacter} onChange={e => update({ mainCharacter: e.target.value })} placeholder="Aaron Reeves — 17, bulletproof, loyal to a fault" />
              </Field>
              <Field label="Villain (one line)">
                <input value={draft.villain} onChange={e => update({ villain: e.target.value })} placeholder="The Director — corporate fixer, erases the inconvenient" />
              </Field>
              <Field label="Setting">
                <input value={draft.setting} onChange={e => update({ setting: e.target.value })} placeholder="New Detroit, near future" />
              </Field>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="eyebrow">Step 6 of 6 — Story Goal</div>
              <Field label="What does this comic exist to do?" hint="Used by the Story Engine to lock the spine of your story.">
                <textarea value={draft.storyGoal} onChange={e => update({ storyGoal: e.target.value })}
                  placeholder="Hero accepts his power, exposes the cover-up, and gives the neighborhood back its name." />
              </Field>
              <Field label="Optional: visual reference notes">
                <textarea value={draft.visualStyle} onChange={e => update({ visualStyle: e.target.value })}
                  placeholder="Influences, color palette, lighting cues, character silhouettes…" />
              </Field>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 gap-3">
            <button onClick={() => (step === 0 ? nav(-1) : setStep(s => s - 1))} className="btn-ghost">
              <ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
            </button>
            <button onClick={onNext} disabled={!valid[step]} className="btn-gold">
              {step === STEPS.length - 1 ? (<><Sparkles size={16} /> Create Project</>) : (<>Continue <ArrowRight size={16} /></>)}
            </button>
          </div>
        </div>

        <div className="mt-5 glass card-pad text-sm flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-electric/10 border border-electric/30 text-electric-glow flex items-center justify-center">
            <Wand2 size={16} />
          </div>
          <div>
            <div className="font-semibold text-paper">After you create the project</div>
            <p className="text-mist mt-0.5">You’ll land on the project hub. From there, build the story spine, lock characters, then generate panel and cover prompts ready for ChatGPT, Claude, Midjourney, Leonardo, Ideogram, DALL·E, Runway, Pika, Kling, Veo, Canva, and Photoshop.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
