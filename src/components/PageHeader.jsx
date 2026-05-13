export default function PageHeader({ eyebrow, title, subtitle, right }) {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
          <h1 className="display-title text-gradient-cinematic">{title}</h1>
          {subtitle && <p className="text-mist mt-2 max-w-prose text-sm sm:text-base">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="rule-gold mt-5" />
    </div>
  );
}
