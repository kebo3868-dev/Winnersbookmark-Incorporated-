import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus, BarChart2, Mail,
  Clock, Calendar, Settings, ShieldCheck, Columns2,
  Zap, X,
} from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NAV: NavItem[] = [
  { to: '/', icon: <LayoutDashboard size={17} />, label: 'Dashboard' },
  { to: '/leads', icon: <Users size={17} />, label: 'Leads' },
  { to: '/leads/new', icon: <UserPlus size={17} />, label: 'Add Lead' },
  { to: '/pipeline', icon: <Columns2 size={17} />, label: 'CRM Pipeline' },
  { to: '/audit', icon: <BarChart2 size={17} />, label: 'Bottleneck Audit' },
  { to: '/emails', icon: <Mail size={17} />, label: 'Email Drafts' },
  { to: '/followups', icon: <Clock size={17} />, label: 'Follow-Ups' },
  { to: '/trials', icon: <Calendar size={17} />, label: '14-Day Trials' },
  { to: '/compliance', icon: <ShieldCheck size={17} />, label: 'Compliance' },
  { to: '/settings', icon: <Settings size={17} />, label: 'Settings' },
];

interface SideNavProps {
  onClose?: () => void;
}

export default function SideNav({ onClose }: SideNavProps) {
  return (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-ink-line">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center shadow-gold">
            <Zap size={16} className="text-ink-black" />
          </div>
          <div>
            <p className="text-sm font-bold text-paper leading-none">Restaurant AI</p>
            <p className="text-[10px] text-mist leading-none mt-0.5">Revenue Agent</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="icon-btn w-8 h-8 lg:hidden">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-0.5 transition-all ${
                isActive
                  ? 'bg-gold/10 border border-gold/20 text-gold-light shadow-gold/10'
                  : 'text-mist hover:text-paper hover:bg-ink-card/60'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-ink-line">
        <p className="text-[10px] text-ghost text-center leading-relaxed">
          Designed by<br />
          <span className="text-mist">Winnersbookmark Incorporated</span>
        </p>
      </div>
    </nav>
  );
}
