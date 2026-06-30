import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Layout from '../components/Layout';
import ArticleCard from '../components/ArticleCard';
import CategoryCard from '../components/CategoryCard';
import MembershipCTA from '../components/MembershipCTA';
import Icon from '../components/Icon';
import { useMeta } from '../lib/useMeta';
import { categoryBySlug, categories } from '../data/categories';
import { postsByCategory } from '../data/posts';
import { accent } from '../lib/format';

export default function CategoryDetail() {
  const { slug } = useParams();
  const category = categoryBySlug(slug);
  useMeta(category?.name, category?.long);

  if (!category) return <Navigate to="/categories" replace />;

  const a = accent(category.accent);
  const inCat = postsByCategory(slug);
  const others = categories.filter((c) => c.slug !== slug).slice(0, 3);

  return (
    <Layout>
      <section className="relative overflow-hidden">
        <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${a.grad} opacity-60`} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12">
          <Link to="/categories" className="inline-flex items-center gap-1.5 text-xs text-mist hover:text-gold-light mb-6">
            <ArrowLeft size={14} /> All Categories
          </Link>
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl border ${a.border} ${a.bg} ${a.text} mb-5`}>
            <Icon name={category.icon} size={26} />
          </div>
          <h1 className="hero-title text-paper">{category.name}</h1>
          <p className="mt-4 text-mist leading-relaxed max-w-2xl">{category.long}</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {inCat.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {inCat.map((p) => (
              <ArticleCard key={p.slug} post={p} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p className="text-mist">
              Fresh {category.name} content is published regularly. Become a member to get it the
              moment it drops.
            </p>
          </div>
        )}

        <div className="mt-20">
          <div className="eyebrow mb-6">Keep Exploring</div>
          <div className="grid sm:grid-cols-3 gap-4">
            {others.map((c) => (
              <CategoryCard key={c.slug} category={c} />
            ))}
          </div>
        </div>
      </div>

      <MembershipCTA variant="band" />
    </Layout>
  );
}
