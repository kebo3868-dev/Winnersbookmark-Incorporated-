import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useStudio } from '../context/StudioContext';
import EmptyState from './EmptyState';
import { BookOpen } from 'lucide-react';

export default function ProjectGuard({ children }) {
  const { id } = useParams();
  const { projects, setActive } = useStudio();
  const nav = useNavigate();
  const project = projects.find(p => p.id === id);

  useEffect(() => {
    if (project) setActive(project.id);
  }, [project, setActive]);

  if (!project) {
    return (
      <div className="page">
        <EmptyState
          icon={BookOpen}
          title="Project not found"
          body="This project may have been deleted or doesn’t exist on this device."
          action={<button className="btn-primary" onClick={() => nav('/projects')}>Back to projects</button>}
        />
      </div>
    );
  }

  return children({ project });
}
