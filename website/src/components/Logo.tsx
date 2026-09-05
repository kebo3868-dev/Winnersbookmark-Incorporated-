/**
 * Wordmark. Drawn rather than imported so there is no image request, no layout
 * shift while it loads, and it stays crisp at any size.
 *
 * The mark is a bookmark shape — the company's name, made literal — with the
 * fold rendered in electric blue.
 */
export function LogoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
      focusable="false"
    >
      <path
        d="M8 3.5h16a2.5 2.5 0 0 1 2.5 2.5v22.2a1 1 0 0 1-1.53.85L16 23.1l-8.97 5.95A1 1 0 0 1 5.5 28.2V6A2.5 2.5 0 0 1 8 3.5Z"
        className="fill-night-card stroke-night-edge"
        strokeWidth="1.5"
      />
      <path d="M11 11.5h10M11 16h6.5" className="stroke-electric-light" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={26} />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-bold tracking-tight text-snow">Winners Bookmark</span>
        <span className="mt-[3px] text-[9px] font-semibold uppercase tracking-[0.18em] text-snow-faint">
          Incorporated
        </span>
      </span>
    </span>
  );
}
