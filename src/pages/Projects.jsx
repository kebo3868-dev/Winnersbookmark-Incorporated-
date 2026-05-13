import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Plus, Trash2, BookOpen, Copy as CopyIcon } from 'lucide-react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProgressRing from '../components/ProgressRing';
import EmptyState from '../components/EmptyState';
import { useStudio, projectProgress, newProject } from '../context/StudioContext';
import { formatDate } from '../lib/ids';

export default function Projects() {
  const { projects, deleteProject, createProject } = useStudio();
  const nav = useNavigate();

  const duplicate = (p) => {
    const copy = newProject({ ...p, title: `${p.title} (Copy)` });
    delete copy.id;
    const np = createProject(copy);
    nav(`/project/${np.id}`);
  };

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Library"
          title="Projects"
          subtitle="All your in-progress and published comic projects, saved on this device."
          right={<Link to="/new" className="btn-gold"><Plus size={16}/> New</Link>}
        />

        {projects.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No projects yet"
            body="Spin up your first cinematic comic — characters, panels, cover, and prompts in one flow."
            action={<Link to="/new" className="btn-gold"><Sparkles size={16}/> Start a Comic</Link>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map(p => (
              <div key={p.id} className="glass card-pad relative group">
                <Link to={`/project/${p.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="eyebrow mb-1">{p.genre || '—'} · {p.style || '—'}</div>
                      <div className="font-display font-semibold text-paper text-lg truncate">{p.title}</div>
                      <div className="text-mist text-xs mt-1 line-clamp-2">{p.logline || 'No logline yet.'}</div>
                    </div>
                    <ProgressRing value={projectProgress(p)} size={52} stroke={5} />
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <span className="chip">{(p.characters || []).length} chars</span>
                    <span className="chip">{(p.pagesList || []).length} pages</span>
                    <span className="chip">Updated {formatDate(p.updatedAt)}</span>
                  </div>
                </Link>
                <div className="flex justify-end gap-1.5 mt-3">
                  <button onClick={() => duplicate(p)} className="btn-ghost text-xs"><CopyIcon size={13}/> Duplicate</button>
                  <button
                    onClick={() => { if (confirm(`Delete "${p.title}"? This cannot be undone.`)) deleteProject(p.id); }}
                    className="btn-ghost text-xs text-mist hover:!text-danger"
                  >
                    <Trash2 size={13}/> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
