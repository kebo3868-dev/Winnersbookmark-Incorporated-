import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { accent } from '../lib/format';

export default function MentorCard({ mentor, compact = false }) {
  const a = accent(mentor.accent);
  return (
    <Link
      to={`/mentors/${mentor.slug}`}
      className="group glass overflow-hidden hover:border-gold/40 transition-all duration-300 flex flex-col"
    >
      <div className={`relative ${compact ? 'aspect-square' : 'aspect-[4/3]'} bg-gradient-to-br ${a.grad} flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-black/85 via-transparent to-transparent" />
        {mentor.image ? (
          <img src={mentor.image} alt={mentor.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className={`font-display text-5xl font-extrabold ${a.text} opacity-80 group-hover:scale-105 transition-transform`}>
            {mentor.initials}
          </span>
        )}
        <span className="absolute bottom-3 left-3 chip text-[10px]">{mentor.era}</span>
      </div>
      <div className="card-pad flex flex-col flex-1">
        <h3 className="font-display text-lg font-bold text-paper group-hover:text-gold-light transition-colors">
          {mentor.name}
        </h3>
        <p className={`text-xs font-semibold ${a.text} mt-0.5`}>{mentor.title}</p>
        {!compact && (
          <p className="mt-2.5 text-sm text-mist leading-relaxed line-clamp-3 flex-1">{mentor.short}</p>
        )}
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-electric-glow group-hover:gap-2 transition-all">
          Study {mentor.name.split(' ')[0]} <ArrowUpRight size={14} />
        </span>
      </div>
    </Link>
  );
}
