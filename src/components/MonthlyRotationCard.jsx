export default function MonthlyRotationCard({ item }) {
  return (
    <article className="glass-strong card-pad accent-top hover:border-gold/60 transition-colors">
      <div className="eyebrow">{item.label}</div>
      <h3 className="mt-2 text-xl font-display font-bold text-paper">{item.value}</h3>
      <p className="mt-2 text-sm text-mist leading-relaxed">{item.detail}</p>
    </article>
  );
}
