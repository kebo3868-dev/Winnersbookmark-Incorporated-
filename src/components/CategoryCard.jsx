import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Icon from './Icon';
import { accent } from '../lib/format';

export default function CategoryCard({ category }) {
  const a = accent(category.accent);
  return (
    <Link
      to={`/categories/${category.slug}`}
      className={`group relative glass card-pad overflow-hidden hover:border-electric/40 transition-all duration-300 flex flex-col`}
    >
      <div
        className={`absolute -top-16 -right-16 w-44 h-44 rounded-full bg-gradient-to-br ${a.glow} to-transparent blur-2xl opacity-50 group-hover:opacity-80 transition-opacity`}
      />
      <div className={`relative inline-flex items-center justify-center w-12 h-12 rounded-xl border ${a.border} ${a.bg} ${a.text} mb-4`}>
        <Icon name={category.icon} size={22} />
      </div>
      <h3 className="relative font-display text-lg font-bold text-paper group-hover:text-gold-light transition-colors">
        {category.name}
      </h3>
      <p className="relative mt-2 text-sm text-mist leading-relaxed flex-1">{category.blurb}</p>
      <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-semibold text-electric-glow group-hover:gap-2 transition-all">
        Explore <ArrowRight size={14} />
      </span>
    </Link>
  );
}
