import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function SectionHeading({ eyebrow, title, blurb, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div className="max-w-2xl">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h2 className="display-title text-paper">{title}</h2>
        {blurb && <p className="mt-3 text-mist leading-relaxed">{blurb}</p>}
      </div>
      {action && (
        <Link
          to={action.to}
          className="btn-ghost shrink-0 whitespace-nowrap !py-2.5"
        >
          {action.label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
