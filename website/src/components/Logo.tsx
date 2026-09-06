/**
 * THE WINNERS BOOKMARK MARK
 *
 * A bookmark reduced to its essential geometry: a vertical plane with a notched
 * foot. The notch is the recognisable element, and it is reused throughout the
 * site — as the eyebrow's leading mark, as node markers in the system
 * visualization, as section dividers, and as list bullets.
 *
 * That reuse is the point. The brief asks for a brand recognisable even with
 * the company name removed, and a logo repeated at large size does not achieve
 * that — a repeated *geometry* does.
 *
 * Drawn, not imported: no image request, no layout shift, crisp at any size,
 * and it inherits currentColor so it works on any surface.
 */

/** The notch, isolated. Used as an accent mark wherever the brand needs a
 *  signature without the full logo. */
export function BookmarkNotch({ className = '', size = 12 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 ${className}`}
      style={{
        width: `${size * 0.28}px`,
        height: `${size}px`,
        background: 'currentColor',
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 76%, 0 100%)',
      }}
    />
  );
}

export function LogoMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Plate */}
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" className="fill-ink-panel stroke-ink-border" />
      {/* Bookmark body — the notched foot is the brand signature */}
      <path
        d="M11 7.5h10a1.5 1.5 0 0 1 1.5 1.5v15.6a.7.7 0 0 1-1.08.59L16 21.3l-5.42 3.89A.7.7 0 0 1 9.5 24.6V9A1.5 1.5 0 0 1 11 7.5Z"
        className="fill-cobalt-core/12 stroke-cobalt-core"
        strokeWidth="1.5"
      />
      {/* Two data rules inside — the "intelligence" half of the identity */}
      <path d="M12.6 12.4h6.8M12.6 15.8h4.2" className="stroke-cobalt-light" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={30} />
      <span className="flex flex-col leading-none">
        <span className="text-[0.9375rem] font-semibold tracking-[-0.022em] text-text-bright">
          Winners Bookmark
        </span>
        <span className="mt-[4px] text-[0.5625rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
          Incorporated
        </span>
      </span>
    </span>
  );
}

/**
 * A section divider carrying the mark at its centre. Used sparingly — it is a
 * punctuation device, not a decoration to sprinkle between every block.
 */
export function BrandRule({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`} aria-hidden="true">
      <div className="h-px flex-1 bg-rule-fade" />
      <BookmarkNotch size={11} className="text-ink-steel" />
      <div className="h-px flex-1 bg-rule-fade" />
    </div>
  );
}
