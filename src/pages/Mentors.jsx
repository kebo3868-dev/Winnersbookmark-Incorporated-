import Layout from '../components/Layout';
import MentorCard from '../components/MentorCard';
import MembershipCTA from '../components/MembershipCTA';
import { PageHero } from './Blog';
import { useMeta } from '../lib/useMeta';
import { mentors } from '../data/mentors';

export default function Mentors() {
  useMeta(
    'Mentors / Biographies — Mentors Worth Studying',
    'Learn from thinkers, speakers, strategists, coaches, and builders whose ideas can shape a stronger life: Jim Rohn, Robert Greene, Marcus Aurelius, and more.'
  );

  return (
    <Layout>
      <PageHero
        eyebrow="Mentors / Biographies"
        title="Mentors Worth Studying"
        blurb="Learn from thinkers, speakers, strategists, coaches, and builders whose ideas can shape a stronger life."
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {mentors.map((m) => (
            <MentorCard key={m.slug} mentor={m} />
          ))}
        </div>
      </div>
      <MembershipCTA variant="band" />
    </Layout>
  );
}
