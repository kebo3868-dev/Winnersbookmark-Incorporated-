import { Link, useNavigate } from 'react-router-dom';
import { Menu, Plus, BookOpenCheck } from 'lucide-react';
import Logo from './Logo';
import { useStudio } from '../context/StudioContext';

export default function TopBar({ onMenu }) {
  const nav = useNavigate();
  const { activeProject } = useStudio();

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-ink-black/70 border-b border-ink-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <button onClick={onMenu} className="icon-btn sm:hidden" aria-label="Open menu">
          <Menu size={18} />
        </button>
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <Logo size={30} />
          <div className="min-w-0 leading-tight">
            <div className="font-display font-bold text-paper tracking-tight text-[15px] truncate">
              Winnersbookmark <span className="text-gradient-gold">CineComic Studio</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-mist hidden sm:block">
              Build the story. Design the world. Generate the panels.
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {activeProject && (
            <Link to={`/project/${activeProject.id}`} className="hidden sm:inline-flex chip-gold max-w-[200px]">
              <BookOpenCheck size={12} />
              <span className="truncate">{activeProject.title}</span>
            </Link>
          )}
          <button onClick={() => nav('/new')} className="btn-primary h-10 px-3.5 sm:px-5 text-sm">
            <Plus size={16} /> <span className="hidden sm:inline">New Comic</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>
    </header>
  );
}
