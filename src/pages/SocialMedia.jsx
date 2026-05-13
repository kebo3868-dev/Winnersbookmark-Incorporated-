import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import PromptCard from '../components/PromptCard';
import { buildSocialKit } from '../lib/exports';

export default function SocialMedia() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const kit = buildSocialKit(project);
  const sections = parseSections(kit);

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Social Media Kit"
          title="Promote the legend"
          subtitle="Captions, hashtags, voiceovers, and carousel scripts — already filled in from your project."
        />

        <div className="grid grid-cols-1 gap-3">
          {sections.map(s => (
            <PromptCard
              key={s.title}
              eyebrow="Social"
              title={s.title}
              prompt={s.body}
              accent={s.title.toLowerCase().includes('hashtags') ? 'electric' : 'gold'}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
}

function parseSections(md) {
  const parts = md.split(/^## /m).filter(Boolean);
  return parts.map(p => {
    const [title, ...rest] = p.split('\n');
    return { title: title.trim(), body: rest.join('\n').trim() };
  });
}
