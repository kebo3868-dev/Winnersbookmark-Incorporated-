import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import { Field } from '../components/Field';
import { useStudio } from '../context/StudioContext';
import PromptCard from '../components/PromptCard';
import { worldPrompt } from '../lib/prompts';

const FIELDS = [
  { k: 'location',    label: 'Main location' },
  { k: 'period',      label: 'Time period' },
  { k: 'culture',     label: 'Culture' },
  { k: 'tech',        label: 'Technology level' },
  { k: 'rules',       label: 'Rules of the world' },
  { k: 'environment', label: 'Visual environment' },
  { k: 'mood',        label: 'Mood' },
  { k: 'palette',     label: 'Color palette' },
  { k: 'landmarks',   label: 'Important landmarks' },
  { k: 'conflict',    label: 'Social conflict' },
  { k: 'danger',      label: 'Hidden danger' },
];

export default function WorldBuilder() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const { updateActive } = useStudio();
  const w = project.world || {};
  const patch = (p) => updateActive({ world: { ...w, ...p } });

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="World Builder"
          title="Design the world it all happens in"
          subtitle="Lock the setting once. Every panel, cover, and prompt will inherit it."
        />

        <div className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">World</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map(f => (
              <Field key={f.k} label={f.label}>
                {['rules','environment','description'].includes(f.k)
                  ? <textarea value={w[f.k] || ''} onChange={e => patch({ [f.k]: e.target.value })} />
                  : <input value={w[f.k] || ''} onChange={e => patch({ [f.k]: e.target.value })} />}
              </Field>
            ))}
            <Field label="World description (free form)">
              <textarea value={w.description || ''} onChange={e => patch({ description: e.target.value })}
                placeholder="Two paragraphs that tell us what it feels like to walk through this world." />
            </Field>
          </div>
        </div>

        <PromptCard
          eyebrow="World image prompt"
          title="Establishing environment prompt"
          prompt={worldPrompt(w, project.style)}
        />
      </div>
    </Layout>
  );
}
