export default function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="w-12 h-12 mx-auto rounded-2xl border border-gold/40 bg-gold/10 flex items-center justify-center mb-3 text-gold-light">
          <Icon size={20} />
        </div>
      )}
      <div className="font-display text-xl font-semibold text-paper">{title}</div>
      {body && <p className="text-mist text-sm mt-1.5 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
