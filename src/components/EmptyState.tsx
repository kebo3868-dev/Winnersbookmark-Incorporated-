import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty flex flex-col items-center gap-4 py-12">
      {icon && (
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-ghost"
          style={{ background: 'rgba(28,37,71,0.4)', border: '1px solid rgba(28,37,71,0.8)' }}
        >
          {icon}
        </div>
      )}
      <div className="text-center">
        <h3 className="text-sm font-semibold text-chalk mb-1">{title}</h3>
        {description && <p className="text-xs text-ghost leading-relaxed">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
