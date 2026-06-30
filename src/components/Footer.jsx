import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import Logo from './Logo';
import { nav, site } from '../data/site';

export default function Footer() {
  return (
    <footer className="relative mt-24 border-t border-ink-line bg-ink-deep/60">
      <div className="accent-top" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo size={40} />
            <p className="mt-4 max-w-sm text-sm text-mist leading-relaxed">
              {site.promise}
            </p>
            <Link to="/membership" className="btn-gold mt-5 !py-2.5 text-sm">
              <Sparkles size={15} />
              Start 7-Day Free Trial
            </Link>
          </div>

          <div>
            <div className="label mb-3">Explore</div>
            <ul className="grid gap-2.5">
              {nav.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-sm text-chalk hover:text-gold-light transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="label mb-3">The Brand</div>
            <ul className="grid gap-2.5 text-sm text-chalk">
              <li>New content daily at {site.postTime}</li>
              <li>${site.pricing.price}/month membership</li>
              <li>{site.pricing.trialDays}-day free trial</li>
              <li>
                <a href={`mailto:${site.email}`} className="hover:text-gold-light transition-colors">
                  {site.email}
                </a>
              </li>
            </ul>
            <div className="mt-4 flex gap-3 text-xs text-ghost">
              <a href={site.social.x} className="hover:text-chalk">X</a>
              <a href={site.social.instagram} className="hover:text-chalk">Instagram</a>
              <a href={site.social.youtube} className="hover:text-chalk">YouTube</a>
              <a href={site.social.tiktok} className="hover:text-chalk">TikTok</a>
            </div>
          </div>
        </div>

        <div className="rule-gold mt-12 mb-6" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ghost">
          <p>Designed by {site.publisher}</p>
          <p>© {new Date().getFullYear()} {site.fullName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
