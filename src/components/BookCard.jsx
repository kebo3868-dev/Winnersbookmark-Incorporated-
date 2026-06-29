import { Link } from 'react-router-dom';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { accent } from '../lib/format';

export default function BookCard({ book }) {
  const a = accent(book.accent);
  const href = book.postSlug ? `/blog/${book.postSlug}` : '/membership';

  return (
    <article className="group glass overflow-hidden hover:border-gold/40 transition-all duration-300 flex flex-col">
      <div className="card-pad flex gap-4">
        {/* Cover placeholder */}
        <div className={`relative shrink-0 w-24 sm:w-28 aspect-[2/3] rounded-lg border ${a.border} bg-gradient-to-br ${a.grad} flex flex-col items-center justify-center p-3 text-center shadow-panel`}>
          <BookOpen size={18} className={`${a.text} mb-2`} />
          <span className="font-display text-xs font-bold text-paper leading-tight">{book.title}</span>
          <span className="mt-1 text-[10px] text-ghost">{book.author}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="font-display text-lg font-bold text-paper group-hover:text-gold-light transition-colors leading-tight">
            {book.title}
          </h3>
          <p className="text-xs text-mist mt-0.5">by {book.author}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {book.themes.map((t) => (
              <span key={t} className="chip text-[10px]">{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 pb-5 flex flex-col flex-1">
        <p className="text-sm text-mist leading-relaxed">{book.summary}</p>
        <div className={`mt-3 rounded-xl border ${a.border} ${a.bg} px-3.5 py-3`}>
          <div className="eyebrow mb-1">Key Lesson</div>
          <p className="text-sm text-chalk leading-relaxed">{book.lesson}</p>
        </div>
        <Link
          to={href}
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-electric-glow group-hover:gap-2 transition-all"
        >
          {book.postSlug ? 'Read the breakdown' : 'Unlock the breakdown'} <ArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  );
}
