import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Quote, Lightbulb } from 'lucide-react';
import Layout from '../components/Layout';
import MentorCard from '../components/MentorCard';
import MembershipCTA from '../components/MembershipCTA';
import { useMeta } from '../lib/useMeta';
import { mentorBySlug, mentors } from '../data/mentors';
import { accent } from '../lib/format';

export default function MentorDetail() {
  const { slug } = useParams();
  const mentor = mentorBySlug(slug);
  useMeta(mentor ? `${mentor.name} — ${mentor.title}` : null, mentor?.short);

  if (!mentor) return <Navigate to="/mentors" replace />;

  const a = accent(mentor.accent);
  const others = mentors.filter((m) => m.slug !== slug).slice(0, 4);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16">
        <Link to="/mentors" className="inline-flex items-center gap-1.5 text-xs text-mist hover:text-gold-light mb-6">
          <ArrowLeft size={14} /> All Mentors
        </Link>

        <div className="grid sm:grid-cols-[200px_1fr] gap-6 sm:gap-8 items-start">
          <div className={`relative aspect-[4/5] rounded-2xl border ${a.border} bg-gradient-to-br ${a.grad} flex items-center justify-center overflow-hidden shadow-panel-lg`}>
            <div className="absolute inset-0 bg-gradient-to-t from-ink-black/85 via-transparent to-transparent" />
            {mentor.image ? (
              <img src={mentor.image} alt={mentor.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className={`font-display text-6xl font-extrabold ${a.text} opacity-80`}>{mentor.initials}</span>
            )}
          </div>
          <div>
            <span className="chip mb-3">{mentor.era}</span>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-paper leading-tight">{mentor.name}</h1>
            <p className={`mt-1 font-semibold ${a.text}`}>{mentor.title}</p>
            <p className="mt-4 text-mist leading-relaxed">{mentor.short}</p>
          </div>
        </div>

        <div className="rule-gold my-12" />

        <h2 className="font-display text-2xl font-bold text-paper mb-4">The Biography</h2>
        <p className="text-[17px] leading-[1.8] text-chalk">{mentor.bio}</p>

        <h2 className="font-display text-2xl font-bold text-paper mt-12 mb-5">Signature Ideas</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {mentor.ideas.map((idea, i) => (
            <div key={i} className="glass card-pad flex items-start gap-3">
              <Lightbulb size={18} className={`${a.text} mt-0.5 shrink-0`} />
              <p className="text-sm text-chalk leading-relaxed">{idea}</p>
            </div>
          ))}
        </div>

        <figure className="my-12 relative pl-6 sm:pl-8">
          <span className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-gold-light to-gold-deep" />
          <Quote size={22} className="text-gold/70 mb-2" />
          <blockquote className="font-display text-xl sm:text-2xl font-semibold text-paper leading-snug">
            “{mentor.ideas[0]}”
          </blockquote>
          <figcaption className="mt-3 eyebrow text-gold/90">— {mentor.name}</figcaption>
        </figure>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        <div className="eyebrow mb-6">More Mentors</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {others.map((m) => (
            <MentorCard key={m.slug} mentor={m} compact />
          ))}
        </div>
      </section>

      <MembershipCTA variant="band" />
    </Layout>
  );
}
