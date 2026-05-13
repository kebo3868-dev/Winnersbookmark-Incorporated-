import { useState } from 'react';
import { Plus, Trash2, Users, ChevronDown, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import EmptyState from '../components/EmptyState';
import PromptCard from '../components/PromptCard';
import { Field } from '../components/Field';
import { useStudio, newCharacter } from '../context/StudioContext';
import { characterPortraitPrompt } from '../lib/prompts';

export default function CharacterVault() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const { updateActive } = useStudio();
  const [openId, setOpenId] = useState(project.characters?.[0]?.id || null);

  const addCharacter = () => {
    const c = newCharacter({ name: 'New Character', role: 'Protagonist' });
    const characters = [...(project.characters || []), c];
    updateActive({ characters });
    setOpenId(c.id);
  };

  const patch = (id, p) => {
    const characters = (project.characters || []).map(c => c.id === id ? { ...c, ...p } : c);
    updateActive({ characters });
  };

  const remove = (id) => {
    if (!confirm('Delete this character?')) return;
    const characters = (project.characters || []).filter(c => c.id !== id);
    updateActive({ characters });
  };

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Character Vault"
          title="The Character Bible"
          subtitle="Lock identities so they stay consistent across every panel."
          right={<button onClick={addCharacter} className="btn-gold"><Plus size={16}/> Add Character</button>}
        />

        {(project.characters || []).length === 0 ? (
          <EmptyState
            icon={Users}
            title="No characters yet"
            body="Add the hero first, then villain, then supporting cast. Each gets a portrait prompt locked to your visual style."
            action={<button onClick={addCharacter} className="btn-gold"><Plus size={16}/> Add Character</button>}
          />
        ) : (
          <div className="space-y-3">
            {project.characters.map(c => {
              const open = openId === c.id;
              return (
                <div key={c.id} className="glass">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : c.id)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 text-gold-light flex items-center justify-center font-comic text-lg shrink-0">
                        {(c.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-semibold text-paper truncate">{c.name || 'Unnamed'}</div>
                        <div className="text-xs text-mist truncate">{c.role || 'Role —'} · {c.age || 'age —'}</div>
                      </div>
                    </div>
                    {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </button>
                  {open && (
                    <div className="px-4 pb-5 space-y-4 slide-up">
                      <div className="field-row">
                        <Field label="Name"><input value={c.name} onChange={e => patch(c.id, { name: e.target.value })}/></Field>
                        <Field label="Age"><input value={c.age} onChange={e => patch(c.id, { age: e.target.value })} placeholder="17"/></Field>
                        <Field label="Role"><input value={c.role} onChange={e => patch(c.id, { role: e.target.value })} placeholder="Protagonist / Villain / Mentor"/></Field>
                        <Field label="Voice / dialogue style"><input value={c.voice} onChange={e => patch(c.id, { voice: e.target.value })} placeholder="Dry, quick, hates wasted words"/></Field>
                      </div>
                      <div className="field-row">
                        <Field label="Personality"><textarea value={c.personality} onChange={e => patch(c.id, { personality: e.target.value })}/></Field>
                        <Field label="Powers / skills"><textarea value={c.powers} onChange={e => patch(c.id, { powers: e.target.value })}/></Field>
                      </div>
                      <div className="field-row">
                        <Field label="Weakness"><textarea value={c.weakness} onChange={e => patch(c.id, { weakness: e.target.value })}/></Field>
                        <Field label="Motivation"><textarea value={c.motivation} onChange={e => patch(c.id, { motivation: e.target.value })}/></Field>
                      </div>
                      <Field label="Backstory"><textarea value={c.backstory} onChange={e => patch(c.id, { backstory: e.target.value })}/></Field>
                      <div className="field-row">
                        <Field label="Costume description"><textarea value={c.costume} onChange={e => patch(c.id, { costume: e.target.value })} placeholder="Hooded navy jacket, gold trim, scuffed boots…"/></Field>
                        <Field label="Signature weapon / object"><input value={c.weapon} onChange={e => patch(c.id, { weapon: e.target.value })}/></Field>
                      </div>
                      <div className="field-row">
                        <Field label="Facial features"><textarea value={c.face} onChange={e => patch(c.id, { face: e.target.value })} placeholder="Heavy brow, faint scar above left eye…"/></Field>
                        <Field label="Body type"><input value={c.body} onChange={e => patch(c.id, { body: e.target.value })} placeholder="Lean, broad-shouldered, 6'1"/></Field>
                      </div>
                      <div className="field-row">
                        <Field label="Color palette"><input value={c.palette} onChange={e => patch(c.id, { palette: e.target.value })} placeholder="Navy, gold, charcoal"/></Field>
                        <Field label="Consistency notes"><input value={c.consistencyNotes} onChange={e => patch(c.id, { consistencyNotes: e.target.value })} placeholder="Always wears the gold ring on right hand"/></Field>
                      </div>

                      <PromptCard
                        eyebrow="Character image prompt"
                        title="Reference sheet prompt"
                        prompt={characterPortraitPrompt(c, project.style)}
                      />

                      <div className="flex justify-end pt-2">
                        <button onClick={() => remove(c.id)} className="btn-ghost text-mist hover:!text-danger text-xs">
                          <Trash2 size={13}/> Delete character
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
