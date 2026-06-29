import { Link } from 'react-router-dom';
import { Sparkles, Check } from 'lucide-react';
import { site } from '../data/site';

// Reusable conversion block. `variant="band"` is the wide homepage section;
// `variant="box"` is a compact in-article CTA.
export default function MembershipCTA({ variant = 'band' }) {
  if (variant === 'box') {
    return (
      <div className="relative glass-strong card-pad-lg overflow-hidden my-10">
        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-gradient-to-br from-gold/25 to-transparent blur-3xl" />
        <div className="relative">
          <div className="eyebrow mb-2">Keep going</div>
          <h3 className="font-display text-2xl font-bold text-paper">
            Enjoying this? Unlock premium daily content.
          </h3>
          <p className="mt-2 text-sm text-mist leading-relaxed max-w-xl">
            Get every deep dive, book breakdown, and mentor playbook — new content daily at{' '}
            {site.postTime}. Just ${site.pricing.price}/month, {site.pricing.trialDays}-day free trial.
          </p>
          <Link to="/membership" className="btn-gold mt-5">
            <Sparkles size={16} />
            Start {site.pricing.trialDays}-Day Free Trial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 my-20 sm:my-28">
      <div className="relative glass-strong overflow-hidden rounded-3xl p-8 sm:p-14">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-gradient-to-br from-electric/25 to-transparent blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-br from-gold/25 to-transparent blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
          <div>
            <div className="eyebrow mb-3">Membership</div>
            <h2 className="hero-title text-paper">
              Upgrade Your Mind <span className="text-gradient-gold">Every Day</span>
            </h2>
            <p className="mt-4 text-mist leading-relaxed max-w-xl">
              Get premium daily content, deep-dive breakdowns, visual learning tools, and
              self-mastery insights for just ${site.pricing.price}/month — with a{' '}
              {site.pricing.trialDays}-day free trial. Cancel anytime.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link to="/membership" className="btn-gold">
                <Sparkles size={17} />
                Start Free Trial
              </Link>
              <Link to="/membership" className="btn-ghost !px-5 !py-3">
                See Membership Benefits
              </Link>
            </div>
          </div>

          <div className="glass card-pad-lg">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-5xl font-extrabold text-paper">${site.pricing.price}</span>
              <span className="text-mist">/{site.pricing.period}</span>
            </div>
            <p className="text-xs text-gold-light mt-1">{site.pricing.trialDays}-day free trial included</p>
            <ul className="mt-5 grid gap-2.5">
              {[
                'New premium content daily',
                'Long-form deep dives & breakdowns',
                'Mentor biographies & playbooks',
                'Full searchable archive',
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-chalk">
                  <Check size={16} className="text-success mt-0.5 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
