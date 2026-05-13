import CopyButton from './CopyButton';

export default function PromptCard({ title, prompt, eyebrow, accent = 'gold', actions, children }) {
  const border = accent === 'electric' ? 'border-electric/40' : 'border-gold/40';
  const bg     = accent === 'electric' ? 'bg-electric/[0.07]' : 'bg-gold/[0.06]';
  return (
    <div className={`glass card-pad accent-top ${border} ${bg} relative`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          {title && <div className="font-display font-semibold text-paper text-base">{title}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {prompt && <CopyButton text={prompt} />}
        </div>
      </div>
      {prompt && (
        <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-chalk font-sans bg-ink-card2/70 border border-ink-line rounded-lg p-3 max-h-[280px] overflow-auto">
          {prompt}
        </pre>
      )}
      {children}
    </div>
  );
}
