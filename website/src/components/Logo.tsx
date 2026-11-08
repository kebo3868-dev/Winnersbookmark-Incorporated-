import { company } from '@/data/site';

/**
 * Brand mark + wordmark. Drawn rather than imported so there is no image
 * request, no layout shift while it loads, and it stays crisp at any size.
 *
 * The mark is a bookmark — the company's name, made literal — in solid white,
 * with its top band in electric blue: the page has been marked. It holds up as
 * a 16px favicon and as a 200px lockup because it is two flat shapes.
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
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" className="fill-night-card stroke-night-edge" />
      <path d="M10.5 7h11a1.5 1.5 0 0 1 1.5 1.5V25l-7-4.6L9 25V8.5A1.5 1.5 0 0 1 10.5 7Z" className="fill-snow" />
      <path d="M10.5 7h11a1.5 1.5 0 0 1 1.5 1.5V11H9V8.5A1.5 1.5 0 0 1 10.5 7Z" className="fill-electric-bright" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={30} />
      <span className="font-display text-[21px] leading-none tracking-[-0.01em] text-snow">
        {company.shortName}
      </span>
    </span>
  );
}
