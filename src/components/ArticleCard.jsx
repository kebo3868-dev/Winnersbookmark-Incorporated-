import { Link } from 'react-router-dom';
import { Clock, Lock, ArrowUpRight } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';
import { categoryBySlug } from '../data/categories';
import { formatDate } from '../lib/format';
import { accent } from '../lib/format';

export default function ArticleCard({ post, variant = 'default' }) {
  const cat = categoryBySlug(post.category);
  const a = accent(cat?.accent);
  const isFeatured = variant === 'featured';

  return (
    <article
      className={`group glass overflow-hidden hover:border-electric/40 transition-all duration-300 ${
        isFeatured ? 'md:grid md:grid-cols-2' : 'flex flex-col'
      }`}
    >
      <Link
        to={`/blog/${post.slug}`}
        className={`relative block overflow-hidden ${isFeatured ? 'md:h-full min-h-[220px]' : ''}`}
      >
        <ImagePlaceholder
          ratio={isFeatured ? 'aspect-[16/10] md:aspect-auto md:h-full' : 'aspect-[16/10]'}
          accent={cat?.accent}
          label={cat?.name}
          className="!rounded-none border-0 group-hover:scale-[1.02] transition-transform duration-500"
        />
        {post.tier === 'member' && (
          <span className="absolute top-3 right-3 chip-gold">
            <Lock size={12} /> Members
          </span>
        )}
      </Link>

      <div className={`card-pad flex flex-col ${isFeatured ? 'sm:p-7 justify-center' : 'flex-1'}`}>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={a.chip}>{cat?.name}</span>
          <span className="text-[11px] text-ghost">{formatDate(post.date)}</span>
        </div>

        <h3
          className={`font-display font-bold tracking-tight text-paper group-hover:text-gold-light transition-colors ${
            isFeatured ? 'text-2xl sm:text-3xl leading-tight' : 'text-lg leading-snug'
          }`}
        >
          <Link to={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>

        <p className={`mt-2.5 text-sm text-mist leading-relaxed ${isFeatured ? '' : 'line-clamp-3'}`}>
          {post.excerpt}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ghost">
            <Clock size={13} /> {post.readTime} min read
          </span>
          <Link
            to={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-electric-glow group-hover:gap-2 transition-all"
          >
            Read <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
