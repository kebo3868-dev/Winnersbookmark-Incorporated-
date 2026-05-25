import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty flex flex-col items-center gap-3 py-14">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center mb-1">
          <Icon size={22} className="text-mist" />
        </div>
      )}
      <p className="section-title text-chalk">{title}</p>
      {description && <p className="text-sm text-mist text-center max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
