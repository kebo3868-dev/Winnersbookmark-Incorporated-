import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import PromptCard from '../components/PromptCard';
import SelectGrid from '../components/SelectGrid';
import { Field } from '../components/Field';
import { useStudio } from '../context/StudioContext';
import { COVER_STYLES } from '../data/coverStyles';
import { coverPrompt } from '../lib/prompts';

export default function CoverCreator() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const { updateActive } = useStudio();
  const c = project.cover || {};
  const patch = (p) => updateActive({ cover: { ...c, ...p } });

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Cover Creator"
          title="Design the cover the legend deserves"
          subtitle="Pick a cover style, set the hero pose, and ship a ready-to-render cover prompt."
        />

        <div className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">Cover Style</div>
          <SelectGrid
            items={COVER_STYLES}
            value={c.coverStyle}
            onChange={(id) => patch({ coverStyle: id })}
            cols="grid-cols-2 sm:grid-cols-4"
          />
        </div>

        <div className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">Cover Content</div>
          <div className="field-row">
            <Field label="Comic title"><input value={c.title || project.title} onChange={e => patch({ title: e.target.value })} /></Field>
            <Field label="Subtitle"><input value={c.subtitle} onChange={e => patch({ subtitle: e.target.value })} placeholder="Volume One"/></Field>
            <Field label="Issue number"><input value={c.issue} onChange={e => patch({ issue: e.target.value })} placeholder="1"/></Field>
            <Field label="Publisher mark"><input value={c.publisher} onChange={e => patch({ publisher: e.target.value })} /></Field>
            <Field label="Main hero (one line)"><input value={c.hero} onChange={e => patch({ hero: e.target.value })} placeholder="Aaron Reeves, hood up, gold ring catching neon"/></Field>
            <Field label="Villain presence"><input value={c.villainPresence} onChange={e => patch({ villainPresence: e.target.value })} placeholder="The Director, faceless, suit, behind glass"/></Field>
            <Field label="Background setting"><input value={c.background} onChange={e => patch({ background: e.target.value })} placeholder="New Detroit skyline at dusk"/></Field>
            <Field label="Dramatic pose"><input value={c.pose} onChange={e => patch({ pose: e.target.value })} placeholder="Mid-stride, looking back, fists balled"/></Field>
            <Field label="Tagline"><input value={c.tagline} onChange={e => patch({ tagline: e.target.value })} placeholder="They wanted him invisible. He chose impossible."/></Field>
            <Field label="Color palette"><input value={c.palette} onChange={e => patch({ palette: e.target.value })} placeholder="Navy, gold, neon"/></Field>
            <Field label="Typography direction"><input value={c.typography} onChange={e => patch({ typography: e.target.value })} placeholder="Bold display serif with metallic foil"/></Field>
          </div>
          <Field label="Back cover blurb">
            <textarea value={c.blurb} onChange={e => patch({ blurb: e.target.value })}
              placeholder="They told him he was nothing. He inherited everything they were trying to bury." />
          </Field>
        </div>

        <PromptCard
          eyebrow="Cover prompt"
          title="Cinematic cover image prompt"
          prompt={coverPrompt({ ...c, style: project.style })}
          accent="gold"
        />
      </div>
    </Layout>
  );
}
