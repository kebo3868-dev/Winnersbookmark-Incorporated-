import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import EmptyState from '../components/EmptyState';
import { Clapperboard } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Storyboard() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const pages = project.pagesList || [];
  if (!pages.length) {
    return (
      <Layout>
        <div className="page">
          <PageHeader eyebrow="Storyboard" title="Storyboard View" />
          <EmptyState
            icon={Clapperboard}
            title="Nothing to storyboard yet"
            body="Build pages and panels first."
            action={<Link to={`/project/${project.id}/pages`} className="btn-gold">Open Page Builder</Link>}
          />
        </div>
      </Layout>
    );
  }

  const totalPanels = pages.reduce((s, p) => s + (p.panels?.length || 0), 0);
  const missing = pages.reduce((s, p) => s + (p.panels?.length === 0 ? 1 : 0), 0);

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Storyboard"
          title="Pages at a glance"
          subtitle="Story pacing, missing panels, and dialogue preview for the entire issue."
          right={
            <div className="flex gap-2">
              <span className="chip-gold">{pages.length} pages</span>
              <span className="chip-blue">{totalPanels} panels</span>
              {missing > 0 && <span className="chip">{missing} empty pages</span>}
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pages.map(pg => (
            <div key={pg.id} className="glass card-pad">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="eyebrow">Page {pg.number}</div>
                  <div className="font-display font-semibold text-paper">{pg.summary || 'No summary'}</div>
                </div>
                <span className="chip">{pg.panels?.length || 0} panels</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(pg.panels || []).map(pn => (
                  <div key={pn.id} className="comic-panel min-h-[110px] p-2.5 text-[10.5px] text-chalk">
                    <div className="text-gold-light font-comic text-[12px] mb-1">PNL {pn.number}</div>
                    <div className="line-clamp-3 mb-1">{pn.action || '—'}</div>
                    {pn.dialogue && (
                      <div className="mt-1 bg-paper/90 text-ink-black rounded-md px-1.5 py-1 text-[9px] leading-tight line-clamp-2">
                        {pn.dialogue.split('\n')[0]}
                      </div>
                    )}
                    {pn.sfx && <div className="mt-1 font-comic text-gold text-[10px] leading-none">{pn.sfx}</div>}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <Link to={`/project/${project.id}/pages`} className="btn-ghost text-xs">Open in builder</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
