import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, Sparkles, FileText, Users, Globe2, BookOpen,
  Image as ImageIcon, BookCopy, MessageSquare, Layers, ListChecks, Share2,
  DollarSign, Download, Settings, Wand2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';

const PRIMARY = [
  { to: '/',          label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/projects',  label: 'Projects',   icon: FolderKanban },
  { to: '/new',       label: 'New Project',icon: Sparkles },
  { to: '/templates', label: 'Templates',  icon: BookCopy },
  { to: '/master',    label: 'Master Prompts', icon: Wand2 },
  { to: '/settings',  label: 'Settings',   icon: Settings },
];

const PROJECT_LINKS = (id) => ([
  { to: `/project/${id}`,            label: 'Overview',     icon: FileText },
  { to: `/project/${id}/story`,      label: 'Story Engine', icon: BookOpen },
  { to: `/project/${id}/characters`, label: 'Character Vault', icon: Users },
  { to: `/project/${id}/world`,      label: 'World Builder',   icon: Globe2 },
  { to: `/project/${id}/pages`,      label: 'Page Builder',    icon: Layers },
  { to: `/project/${id}/prompts`,    label: 'Panel Prompts',   icon: ImageIcon },
  { to: `/project/${id}/cover`,      label: 'Cover Creator',   icon: BookCopy },
  { to: `/project/${id}/dialogue`,   label: 'Dialogue Writer', icon: MessageSquare },
  { to: `/project/${id}/storyboard`, label: 'Storyboard View', icon: Layers },
  { to: `/project/${id}/continuity`, label: 'Continuity',      icon: ListChecks },
  { to: `/project/${id}/social`,     label: 'Social Kit',      icon: Share2 },
  { to: `/project/${id}/monetize`,   label: 'Monetization',    icon: DollarSign },
  { to: `/project/${id}/export`,     label: 'Export Center',   icon: Download },
]);

function Item({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to} end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-gold/10 text-gold-light border border-gold/30'
            : 'text-chalk hover:text-paper hover:bg-white/[0.04] border border-transparent'
        }`
      }
    >
      <Icon size={16} />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export default function SideNav({ open, onClose }) {
  const { id: routeId } = useParams();
  const { activeProject } = useStudio();
  const projectId = routeId || activeProject?.id;

  return (
    <>
      {/* Mobile drawer */}
      <div
        className={`sm:hidden fixed inset-0 z-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60" />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-[280px] bg-ink-deep border-r border-ink-line p-4 overflow-y-auto transition-transform ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <NavBody projectId={projectId} onNavigate={onClose} />
        </aside>
      </div>

      {/* Desktop rail */}
      <aside className="hidden sm:block w-[260px] shrink-0 sticky top-14 self-start max-h-[calc(100vh-3.5rem)] overflow-y-auto py-5 pr-3 border-r border-ink-line">
        <NavBody projectId={projectId} />
      </aside>
    </>
  );
}

function NavBody({ projectId, onNavigate }) {
  return (
    <div className="space-y-5" onClick={onNavigate}>
      <div className="space-y-1">
        <div className="eyebrow px-2 mb-1">Studio</div>
        {PRIMARY.map(i => <Item key={i.to} {...i} />)}
      </div>
      {projectId && (
        <div className="space-y-1">
          <div className="eyebrow px-2 mb-1">Project</div>
          {PROJECT_LINKS(projectId).map(i => <Item key={i.to} {...i} />)}
        </div>
      )}
    </div>
  );
}
