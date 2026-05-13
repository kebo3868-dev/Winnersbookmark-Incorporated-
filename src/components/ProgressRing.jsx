export default function ProgressRing({ value = 0, size = 64, stroke = 6, label }) {
  const r  = (size - stroke) / 2;
  const c  = 2 * Math.PI * r;
  const v  = Math.max(0, Math.min(100, value));
  const dash = (v / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="#1c2547" strokeWidth={stroke} fill="none" />
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke="url(#ringGold)" strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
        <defs>
          <linearGradient id="ringGold" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f5d061" />
            <stop offset="1" stopColor="#d4af37" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display font-bold text-paper text-base leading-none">{v}%</div>
        {label && <div className="text-[9.5px] uppercase tracking-wider text-mist mt-0.5">{label}</div>}
      </div>
    </div>
  );
}
