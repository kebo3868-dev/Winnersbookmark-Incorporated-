import Layout from '../components/Layout';
import CategoryCard from '../components/CategoryCard';
import MembershipCTA from '../components/MembershipCTA';
import { PageHero } from './Blog';
import { useMeta } from '../lib/useMeta';
import { categories } from '../data/categories';

export default function Categories() {
  useMeta(
    'Categories — Browse by Discipline',
    'Browse Winners Bookmark content by topic: discipline, focus, fitness, nutrition, money, leadership, books, mentors, and self-mastery.'
  );

  return (
    <Layout>
      <PageHero
        eyebrow="Categories"
        title="Choose Your Battle"
        blurb="Every category is a front in the same war — the war for self-mastery. Pick where you’re building today."
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {categories.map((c) => (
            <CategoryCard key={c.slug} category={c} />
          ))}
        </div>
      </div>
      <MembershipCTA variant="band" />
    </Layout>
  );
}
