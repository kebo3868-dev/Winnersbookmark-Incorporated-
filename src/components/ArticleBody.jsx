import { Quote, Check, Zap, BookOpen, Users, Lightbulb } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';

// Renders the structured `body` block array of a post into premium,
// magazine-style article markup.
export default function ArticleBody({ blocks }) {
  return (
    <div className="article-body">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

function Block({ block }) {
  switch (block.type) {
    case 'p':
      return <p className="text-[17px] leading-[1.8] text-chalk my-5">{block.text}</p>;

    case 'h2':
      return (
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-paper mt-12 mb-4 scroll-mt-24">
          {block.text}
        </h2>
      );

    case 'h3':
      return (
        <h3 className="font-display text-xl font-bold text-gold-light mt-8 mb-3">{block.text}</h3>
      );

    case 'quote':
      return (
        <figure className="my-9 relative pl-6 sm:pl-8">
          <span className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-gold-light to-gold-deep" />
          <Quote size={22} className="text-gold/70 mb-2" />
          <blockquote className="font-display text-xl sm:text-2xl font-semibold text-paper leading-snug">
            “{block.text}”
          </blockquote>
          {block.cite && (
            <figcaption className="mt-3 eyebrow text-gold/90">— {block.cite}</figcaption>
          )}
        </figure>
      );

    case 'list':
      return (
        <ul className="my-6 grid gap-3">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-[16px] leading-relaxed text-chalk">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-electric shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      );

    case 'image':
      return (
        <figure className="my-9">
          <ImagePlaceholder ratio="aspect-[16/9]" label="Visual" caption={block.caption} />
        </figure>
      );

    case 'takeaways':
      return (
        <InsightBox icon={Check} accent="success" title="Key Takeaways" items={block.items} />
      );

    case 'actions':
      return <InsightBox icon={Zap} accent="electric" title="Action Steps" items={block.items} ordered />;

    case 'callout':
      return (
        <aside className="my-8 glass-strong card-pad-lg border-l-4 border-l-gold">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={18} className="text-gold-light" />
            <span className="eyebrow">{block.title}</span>
          </div>
          <p className="text-[16px] leading-relaxed text-paper">{block.text}</p>
        </aside>
      );

    case 'lesson':
      return (
        <aside className="my-8 rounded-2xl border border-electric/30 bg-electric/[0.07] card-pad-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={18} className="text-electric-glow" />
            <span className="eyebrow text-electric-glow">Lesson From the Book</span>
          </div>
          <p className="text-sm font-semibold text-electric-glow mb-1">{block.book}</p>
          <p className="text-[16px] leading-relaxed text-chalk">{block.text}</p>
        </aside>
      );

    case 'meaning':
      return (
        <aside className="my-8 rounded-2xl border border-gold/30 bg-gold/[0.06] card-pad-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-gold-light" />
            <span className="eyebrow">What This Means for Men Today</span>
          </div>
          <p className="text-[16px] leading-relaxed text-paper">{block.text}</p>
        </aside>
      );

    case 'divider':
      return <div className="rule-gold my-10" />;

    default:
      return null;
  }
}

function InsightBox({ icon: Icon, accent, title, items, ordered }) {
  const border =
    accent === 'success'
      ? 'border-success/30 bg-success/[0.06]'
      : 'border-electric/30 bg-electric/[0.07]';
  const color = accent === 'success' ? 'text-success' : 'text-electric-glow';
  return (
    <aside className={`my-8 rounded-2xl border ${border} card-pad-lg`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className={color} />
        <span className={`eyebrow ${color}`}>{title}</span>
      </div>
      <ul className="grid gap-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-[16px] leading-relaxed text-chalk">
            {ordered ? (
              <span className={`shrink-0 w-6 h-6 rounded-full border ${border} flex items-center justify-center text-xs font-bold ${color}`}>
                {i + 1}
              </span>
            ) : (
              <Icon size={16} className={`${color} mt-1 shrink-0`} />
            )}
            {item}
          </li>
        ))}
      </ul>
    </aside>
  );
}
