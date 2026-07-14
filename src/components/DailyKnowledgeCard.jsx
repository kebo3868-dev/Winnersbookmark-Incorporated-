export default function DailyKnowledgeCard({ item }) {
  const Icon = item.icon;
  return (
    <article className="glass card-pad group hover:-translate-y-1 hover:border-gold/50 transition-all duration-300">
      {Icon && <Icon className="text-gold-light mb-4" size={22} />}
      <h3 className="font-semibold text-paper">{item.title}</h3>
      <p className="text-sm text-mist leading-relaxed mt-2">{item.text}</p>
      <div className="chip-gold mt-4">{item.action}</div>
    </article>
  );
}
