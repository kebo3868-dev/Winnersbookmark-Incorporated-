export default function Logo({ size = 32, className = '' }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#d4af37" />
          <stop offset="1" stopColor="#f5d061" />
        </linearGradient>
        <linearGradient id="lb" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e40af" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#05060d" />
      <rect x="8"  y="10" width="22" height="32" rx="2" fill="url(#lb)" opacity="0.95" />
      <rect x="32" y="10" width="22" height="22" rx="2" fill="url(#lg)" />
      <rect x="32" y="34" width="22" height="20" rx="2" fill="#0f172a" stroke="url(#lg)" strokeWidth="1.5" />
      <rect x="8"  y="44" width="22" height="10" rx="2" fill="#0f172a" stroke="url(#lb)" strokeWidth="1.5" />
      <circle cx="44" cy="44" r="3" fill="url(#lg)" />
    </svg>
  );
}
