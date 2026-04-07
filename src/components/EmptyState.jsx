export default function EmptyState({ icon: Icon, title, description, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && <Icon size={48} className="text-wb-muted/40 mb-4" />}
      <h3 className="text-lg font-semibold text-wb-white mb-2">{title}</h3>
      {description && <p className="text-sm text-wb-muted mb-6 max-w-xs">{description}</p>}
      {action && onAction && (
        <button onClick={onAction} className="btn-primary">
          {action}
        </button>
      )}
    </div>
  );
}
