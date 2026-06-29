import { useState } from 'react';
import { Check, Plus, Minus, Star } from 'lucide-react';
import Layout from '../components/Layout';
import CheckoutButtons from '../components/CheckoutButtons';
import { useMeta } from '../lib/useMeta';
import { site, memberBenefits } from '../data/site';

const faqs = [
  {
    q: 'What do I get with membership?',
    a: 'Full access to everything: premium daily articles, long-form deep dives, complete book breakdowns, mentor biographies and playbooks, visual infographics and insight cards, and the entire searchable archive. New content is published every day at 7:00 AM.',
  },
  {
    q: 'Is there a free trial?',
    a: `Yes. Every membership starts with a ${site.pricing.trialDays}-day free trial. You get full access immediately and you’re only charged if you stay past the trial. No risk, no pressure.`,
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Absolutely. There are no contracts and no lock-in. Cancel in a couple of clicks from your account or checkout provider, anytime, for any reason.',
  },
  {
    q: 'How often is new content published?',
    a: 'A new premium article drops daily at 7:00 AM, with longer weekly deep dives for members who want to go deeper on a single topic, book, or mentor.',
  },
  {
    q: 'Is this for beginners or advanced readers?',
    a: 'Both. Whether you’re just starting to take discipline seriously or you’ve been at it for years, the content is written to be immediately useful — clear enough for beginners, deep enough for the experienced.',
  },
  {
    q: 'What topics are included?',
    a: 'Discipline, focus, fitness, nutrition, money, goal setting, self-mastery, masculinity, leadership, purpose, habits, book breakdowns, and mentor biographies — the full curriculum for becoming a stronger, sharper man.',
  },
];

export default function Membership() {
  useMeta(
    'Membership — Daily Content for Men Who Refuse to Drift',
    `Join Winners Bookmark for $${site.pricing.price}/month with a ${site.pricing.trialDays}-day free trial. Premium daily content on discipline, focus, money, fitness, mindset, and purpose.`
  );

  return (
    <Layout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[80%] h-[80%] rounded-full bg-gradient-to-br from-gold/15 to-transparent blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-10 text-center">
          <div className="eyebrow mb-3">Membership</div>
          <h1 className="hero-title text-paper">
            Daily Content for Men Who <span className="text-gradient-gold">Refuse to Drift</span>
          </h1>
          <p className="mt-4 text-mist leading-relaxed max-w-2xl mx-auto">
            Get access to premium self-improvement content focused on discipline, focus, money,
            fitness, mindset, and purpose — published every day at {site.postTime}.
          </p>
        </div>
      </section>

      {/* Pricing card */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative glass-strong rounded-3xl overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-gold/25 to-transparent blur-3xl" />
          <div className="relative grid md:grid-cols-2">
            <div className="card-pad-lg sm:p-10 border-b md:border-b-0 md:border-r border-ink-line">
              <span className="chip-gold mb-4"><Star size={12} /> All-Access Membership</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-display text-6xl font-extrabold text-paper">${site.pricing.price}</span>
                <span className="text-mist text-lg">/{site.pricing.period}</span>
              </div>
              <p className="text-gold-light text-sm mt-2 font-medium">
                {site.pricing.trialDays}-day free trial · cancel anytime
              </p>
              <div className="mt-7">
                <CheckoutButtons stacked />
              </div>
              <p className="mt-4 text-xs text-ghost text-center leading-relaxed">
                Secure checkout via Stripe or Gumroad. You won’t be charged until your{' '}
                {site.pricing.trialDays}-day trial ends.
              </p>
            </div>

            <div className="card-pad-lg sm:p-10">
              <div className="eyebrow mb-4">Everything included</div>
              <ul className="grid gap-3">
                {memberBenefits.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-chalk">
                    <Check size={16} className="text-success mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-20">
        <div className="text-center mb-8">
          <div className="eyebrow mb-2">Questions</div>
          <h2 className="display-title text-paper">Everything you need to know</h2>
        </div>
        <div className="grid gap-3">
          {faqs.map((f, i) => (
            <FaqItem key={i} {...f} />
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-16 text-center">
        <div className="glass-strong card-pad-lg sm:p-10">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-paper">
            Stop drifting. Start building.
          </h2>
          <p className="mt-3 text-mist max-w-lg mx-auto leading-relaxed">
            The man you want to be is built one disciplined day at a time. Today is a good day to
            start.
          </p>
          <div className="mt-6 max-w-md mx-auto">
            <CheckoutButtons />
          </div>
        </div>
      </section>
    </Layout>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 card-pad text-left"
        aria-expanded={open}
      >
        <span className="font-semibold text-paper text-sm sm:text-base">{q}</span>
        <span className="icon-btn shrink-0 !w-8 !h-8">
          {open ? <Minus size={16} /> : <Plus size={16} />}
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 -mt-1 fade-in">
          <p className="text-sm text-mist leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}
