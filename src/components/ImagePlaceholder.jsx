import { ImageIcon } from 'lucide-react';

// A premium, branded placeholder standing in for hero / article / cover
// imagery. Swap these out for real <img> tags as you produce visuals.
export default function ImagePlaceholder({
  label,
  caption,
  ratio = 'aspect-[16/9]',
  accent = 'gold',
  className = '',
  children,
}) {
  const glow =
    accent === 'electric'
      ? 'from-electric/25 via-ink-navy to-ink-black'
      : accent === 'crimson'
      ? 'from-[#7f1d1d]/30 via-ink-navy to-ink-black'
      : 'from-gold/20 via-ink-navy to-ink-black';

  return (
    <div
      className={`relative ${ratio} w-full overflow-hidden rounded-2xl border border-ink-line bg-gradient-to-br ${glow} ${className}`}
    >
      {/* subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-black/80 via-transparent to-transparent" />
      {children}
      {(label || caption) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <ImageIcon size={26} className="text-mist/60 mb-2" />
          {label && <div className="eyebrow text-mist">{label}</div>}
          {caption && (
            <p className="mt-2 max-w-md text-xs text-ghost leading-relaxed">{caption}</p>
          )}
        </div>
      )}
    </div>
  );
}
