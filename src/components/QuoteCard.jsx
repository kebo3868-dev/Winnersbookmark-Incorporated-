import { Quote } from 'lucide-react';

export default function QuoteCard({ quote, law, chapter, variant = 'default' }) {
  if (variant === 'hero') {
    return (
      <div className="wb-card p-8 relative overflow-hidden">
        <div className="absolute top-4 left-4 text-wb-blue/20">
          <Quote className="w-16 h-16" />
        </div>
        <div className="relative z-10">
          <p className="text-xl md:text-2xl text-wb-white font-semibold leading-relaxed italic">
            "{quote}"
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-wb-border" />
            <span className="text-wb-blue-glow text-sm font-medium">James Clear</span>
            <span className="text-wb-muted text-xs">— Atomic Habits</span>
          </div>
          {law && (
            <span className="mt-3 inline-block bg-wb-blue/10 text-wb-blue-glow text-xs px-3 py-1 rounded-full border border-wb-blue/20">
              {law}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="bg-wb-dark border border-wb-border/50 rounded-xl p-4">
        <p className="text-wb-white text-sm leading-relaxed italic">"{quote}"</p>
        {law && <p className="text-wb-blue-glow text-xs mt-2 font-medium">{law}</p>}
      </div>
    );
  }

  // default
  return (
    <div className="wb-card p-6 group hover:border-wb-blue/40 transition-all duration-300">
      <Quote className="w-6 h-6 text-wb-blue/40 mb-3 group-hover:text-wb-blue/60 transition-colors" />
      <p className="text-wb-white text-base leading-relaxed italic mb-4">"{quote}"</p>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-wb-muted text-xs">— James Clear, Atomic Habits</span>
        {law && (
          <span className="bg-wb-blue/10 text-wb-blue-glow text-xs px-3 py-1 rounded-full border border-wb-blue/20">
            {law}
          </span>
        )}
      </div>
      {chapter && (
        <p className="text-wb-border text-xs mt-2">{chapter}</p>
      )}
    </div>
  );
}
