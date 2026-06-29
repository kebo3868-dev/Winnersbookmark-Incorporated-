import Layout from '../components/Layout';
import BookCard from '../components/BookCard';
import MembershipCTA from '../components/MembershipCTA';
import { PageHero } from './Blog';
import { useMeta } from '../lib/useMeta';
import { books } from '../data/books';

export default function Books() {
  useMeta(
    'Books / Deep Dives — Books That Build Better Men',
    'Deep breakdowns, visual summaries, lessons, and real-world application of the books that build better men — Deep Work, 48 Laws of Power, Atomic Habits, and more.'
  );

  return (
    <Layout>
      <PageHero
        eyebrow="Books / Deep Dives"
        title="Books That Build Better Men"
        blurb="Deep breakdowns, visual summaries, lessons, strategy, and real-world application. We read the hard books so the wisdom reaches your life."
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-5">
          {books.map((b) => (
            <BookCard key={b.slug} book={b} />
          ))}
        </div>
      </div>
      <MembershipCTA variant="band" />
    </Layout>
  );
}
