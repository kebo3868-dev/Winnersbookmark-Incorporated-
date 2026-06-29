// Winners Bookmark wordmark + bookmark "W" glyph.
export function LogoMark({ size = 36, className = '' }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="wbGold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f5d061" />
          <stop offset="1" stopColor="#a67c00" />
        </linearGradient>
        <linearGradient id="wbBlue" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#080b18" />
      <rect x="1.5" y="1.5" width="61" height="61" rx="13.5" fill="none" stroke="url(#wbGold)" strokeOpacity="0.5" strokeWidth="1" />
      {/* Bookmark ribbon */}
      <path d="M20 12h24a3 3 0 0 1 3 3v37l-15-9-15 9V15a3 3 0 0 1 3-3z" fill="url(#wbBlue)" opacity="0.16" />
      <path d="M20 12h24a3 3 0 0 1 3 3v37l-15-9-15 9V15a3 3 0 0 1 3-3z" fill="none" stroke="url(#wbGold)" strokeWidth="2" strokeLinejoin="round" />
      {/* W mark */}
      <path d="M22 22l4 16 6-12 6 12 4-16" fill="none" stroke="url(#wbGold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ size = 36, withText = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withText && (
        <span className="leading-none">
          <span className="block font-display text-base font-bold tracking-tight text-paper">
            Winners Bookmark
          </span>
          <span className="block eyebrow mt-0.5">Daily Blogs</span>
        </span>
      )}
    </span>
  );
}
