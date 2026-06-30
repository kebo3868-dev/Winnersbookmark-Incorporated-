import { Link } from 'react-router-dom';
import { ShieldCheck, Crosshair, Dumbbell, Banknote, Brain, Compass, ArrowRight } from 'lucide-react';
import Layout from '../components/Layout';
import ImagePlaceholder from '../components/ImagePlaceholder';
import MembershipCTA from '../components/MembershipCTA';
import { useMeta } from '../lib/useMeta';
import { site } from '../data/site';

const pillars = [
  { icon: Brain, t: 'Mindset', d: 'Emotional control, mental toughness, and the inner game.' },
  { icon: ShieldCheck, t: 'Discipline', d: 'Systems and standards that hold on your worst days.' },
  { icon: Crosshair, t: 'Focus', d: 'Deep work and the reclamation of your attention.' },
  { icon: Dumbbell, t: 'Health', d: 'Training and nutrition as keystone disciplines.' },
  { icon: Banknote, t: 'Money', d: 'Financial control, leverage, and long-game wealth.' },
  { icon: Compass, t: 'Purpose', d: 'Direction, meaning, and the end of the drift.' },
];

export default function About() {
  useMeta(
    'About — Why Winners Bookmark Daily Blogs Exists',
    'Winners Bookmark Daily Blogs is a premium platform built to help men become stronger, wiser, more disciplined, more focused, and more intentional.'
  );

  return (
    <Layout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-30%] right-[-10%] w-[60%] h-[80%] rounded-full bg-gradient-to-br from-electric/15 to-transparent blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-8">
          <div className="eyebrow mb-3">About</div>
          <h1 className="hero-title text-paper">
            Why Winners Bookmark Daily Blogs Exists
          </h1>
          <p className="mt-5 text-lg text-chalk leading-relaxed">
            Most men aren’t short on information. They’re drowning in it — and starving for
            structure, clarity, and a reason to use it. We built this platform to fix that.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <ImagePlaceholder
          ratio="aspect-[16/7]"
          accent="gold"
          label="The Mission"
          caption="A cinematic brand image — discipline, ambition, and quiet strength."
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-12">
        <p className="text-[17px] leading-[1.8] text-chalk">
          Winners Bookmark Daily Blogs is a premium men’s improvement platform. Every day, we
          publish powerful, practical content designed to help men become more disciplined, more
          focused, mentally stronger, financially sharper, physically capable, and strategically
          self-directed. This isn’t shallow motivation that evaporates by lunch. It’s a serious,
          structured curriculum for self-mastery.
        </p>
        <p className="text-[17px] leading-[1.8] text-chalk mt-5">
          We believe a man becomes great the same way he builds anything worthwhile — through
          disciplined daily reps, the right knowledge, and the company of people and ideas that pull
          him up. So we combined mindset, books, strategy, health, money, and masculine growth into
          one platform with a single promise: <span className="text-gold-light font-semibold">{site.tagline}</span>
        </p>

        <div className="rule-gold my-12" />

        <h2 className="font-display text-2xl font-bold text-paper mb-6">What We Bring Together</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pillars.map(({ icon: Icon, t, d }) => (
            <div key={t} className="glass card-pad">
              <Icon size={22} className="text-gold-light mb-3" />
              <h3 className="font-semibold text-paper">{t}</h3>
              <p className="text-sm text-mist mt-1 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 glass-strong card-pad-lg">
          <div className="eyebrow mb-2">Who This Is For</div>
          <p className="text-chalk leading-relaxed">
            Ambitious men. Men rebuilding their lives. Men chasing a purpose bigger than themselves.
            Men who want modern wisdom in a form that’s visual, readable, and genuinely useful —
            whether they’re 18 or 70. If you refuse to drift, you’re in the right place.
          </p>
          <Link to="/membership" className="btn-gold mt-6">
            Start your free trial <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <MembershipCTA variant="band" />
    </Layout>
  );
}
