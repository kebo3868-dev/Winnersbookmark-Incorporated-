import { Link } from 'react-router-dom';
import {
  Sparkles, ArrowRight, Check, Flame, Compass, ShieldCheck, Quote,
} from 'lucide-react';
import Layout from '../components/Layout';
import SectionHeading from '../components/SectionHeading';
import ArticleCard from '../components/ArticleCard';
import CategoryCard from '../components/CategoryCard';
import MentorCard from '../components/MentorCard';
import BookCard from '../components/BookCard';
import MembershipCTA from '../components/MembershipCTA';
import VisionBoard from '../components/VisionBoard';
import ImagePlaceholder from '../components/ImagePlaceholder';
import DailyKnowledgeCard from '../components/DailyKnowledgeCard';
import MonthlyRotationCard from '../components/MonthlyRotationCard';
import LifestyleCard from '../components/LifestyleCard';
import { useMeta } from '../lib/useMeta';
import { site, trustBullets } from '../data/site';
import { categories } from '../data/categories';
import { mentors } from '../data/mentors';
import { books } from '../data/books';
import { latestPost, featuredPosts, sortedPosts } from '../data/posts';
import { dailyKnowledge } from '../data/dailyKnowledge';
import { monthlyRotation } from '../data/monthlyRotation';
import { lifestyleCards } from '../data/lifestyleCards';

export default function Home() {
  useMeta(
    'Discipline, Focus, Fitness, Money, and Self-Mastery for Men',
    'A premium men’s improvement platform featuring daily content on discipline, focus, books, money, fitness, nutrition, leadership, and self-mastery. Start your 7-day free trial.'
  );

  const today = latestPost();
  const deepDives = featuredPosts();
  const recent = sortedPosts().slice(0, 6);

  return (
    <Layout>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[80%] rounded-full bg-gradient-to-br from-electric/20 to-transparent blur-3xl" />
          <div className="absolute bottom-[-30%] right-[-10%] w-[60%] h-[80%] rounded-full bg-gradient-to-br from-gold/15 to-transparent blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14">
          <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
            <div className="slide-up">
              <div className="inline-flex items-center gap-2 chip-gold mb-5">
                <Flame size={13} /> New content daily at {site.postTime}
              </div>
              <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-[1.04] tracking-tight text-paper">
                Winners Bookmark{' '}
                <span className="text-gradient-gold">Daily Blogs</span>
              </h1>
              <p className="mt-5 text-lg text-chalk leading-relaxed max-w-xl">
                Daily insight for discipline, focus, strength, money, purpose, and self-mastery.
              </p>
              <p className="mt-3 text-mist leading-relaxed max-w-xl">
                {site.promise}
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Link to="/membership" className="btn-gold text-base">
                  <Sparkles size={18} />
                  Start {site.pricing.trialDays}-Day Free Trial
                </Link>
                <Link to={`/blog/${today.slug}`} className="btn-ghost !px-5 !py-3 text-base">
                  Explore Today’s Blog
                  <ArrowRight size={17} />
                </Link>
              </div>

              <ul className="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {trustBullets.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sm text-chalk">
                    <Check size={16} className="text-gold-light shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Cinematic hero collage */}
            <div className="relative">
              <ImagePlaceholder
                ratio="aspect-[4/5]"
                accent="gold"
                label="Cinematic Hero"
                caption="Masculine lifestyle imagery — discipline, strength, focus, ambition. Drop in your hero visual here."
                className="shadow-panel-lg"
              />
              <div className="absolute -bottom-5 -left-5 glass-strong card-pad max-w-[230px] hidden sm:block">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={16} className="text-gold-light" />
                  <span className="eyebrow">Today’s Standard</span>
                </div>
                <p className="text-sm text-paper font-medium leading-snug">
                  “Discipline weighs ounces. Regret weighs tons.”
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ DAILY KNOWLEDGE ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
        <SectionHeading
          eyebrow="Every Day, New Knowledge"
          title="Daily Standards That Make the Platform Feel Alive"
          blurb="Nothing stays stale. Every day brings a lesson, a strategy, a health insight, a money habit, a book idea, and an action step."
          action={{ label: 'Today’s Knowledge', to: '/today' }}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dailyKnowledge.map((item) => <DailyKnowledgeCard key={item.title} item={item} />)}
        </div>
      </section>

      {/* ============ MONTHLY ROTATION ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24">
        <SectionHeading
          eyebrow="Monthly Rotation"
          title="New Mentors. New Books. New Standards Every Month."
          blurb="The mentor board, book stack, discipline challenge, fitness focus, and money skill are built to rotate monthly."
          action={{ label: 'View Rotation', to: '/monthly-rotation' }}
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthlyRotation.map((item) => <MonthlyRotationCard key={item.label} item={item} />)}
        </div>
      </section>

      {/* ============ MEN OF ALL AGES ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24">
        <SectionHeading
          eyebrow="Built for Every Man Still Becoming"
          title="Growth Does Not Expire. Discipline Has No Age Limit."
          blurb="Young men, fathers, leaders, builders, and older men still sharpening the blade — every man can become stronger, wiser, healthier, and more focused."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {lifestyleCards.map((item) => <LifestyleCard key={item.title} item={item} />)}
        </div>
      </section>

      {/* ============ FEATURED TODAY ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <SectionHeading
          eyebrow="Featured Today"
          title="Start Here"
          blurb="The newest drop from the desk — read it, then put one idea into practice before noon."
          action={{ label: 'All Articles', to: '/blog' }}
        />
        <ArticleCard post={today} variant="featured" />
      </section>

      {/* ============ CORE CONTENT PILLARS ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-20">
        <SectionHeading
          eyebrow="Content Pillars"
          title="Build Every Part of the Man"
          blurb="Twelve disciplines, one mission: become harder to break and harder to beat."
          action={{ label: 'All Categories', to: '/categories' }}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {categories.slice(0, 8).map((c) => (
            <CategoryCard key={c.slug} category={c} />
          ))}
        </div>
      </section>

      {/* ============ WHY THIS EXISTS ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24">
        <div className="glass-strong rounded-3xl p-8 sm:p-12 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="eyebrow mb-3">Why This Platform Exists</div>
            <h2 className="display-title text-paper">
              Modern men don’t need more <span className="text-gradient-electric">noise</span>. They need structure.
            </h2>
            <p className="mt-4 text-mist leading-relaxed">
              The internet is drowning in shallow motivation — loud, forgettable, and useless by
              lunch. Winners Bookmark is built for the opposite: clear, strategic, deeply useful
              content that helps a man become more disciplined, more focused, stronger, sharper with
              money, and more certain of his purpose. No fluff. No cheap hype. Just the daily tools
              for self-mastery.
            </p>
            <Link to="/about" className="btn-ghost mt-6 !py-2.5">
              Read our mission <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: ShieldCheck, t: 'Discipline over motivation', d: 'Systems that work on your worst days.' },
              { icon: Compass, t: 'Direction over drift', d: 'Content built around purpose and clarity.' },
              { icon: Flame, t: 'Depth over noise', d: 'Strategic long-form, not shallow takes.' },
              { icon: Quote, t: 'Wisdom worth keeping', d: 'Books, mentors, and timeless ideas.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="glass card-pad">
                <Icon size={20} className="text-gold-light mb-3" />
                <h3 className="font-semibold text-paper text-sm">{t}</h3>
                <p className="text-xs text-mist mt-1 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURED DEEP DIVES ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24">
        <SectionHeading
          eyebrow="Featured Deep Dives"
          title="Premium Long-Form"
          blurb="The flagship breakdowns — strategy, books, and frameworks you can actually apply."
          action={{ label: 'View Blog', to: '/blog' }}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {deepDives.map((p) => (
            <ArticleCard key={p.slug} post={p} />
          ))}
          {recent.filter((r) => !deepDives.some((d) => d.slug === r.slug)).slice(0, 3 - deepDives.length).map((p) => (
            <ArticleCard key={p.slug} post={p} />
          ))}
        </div>
      </section>

      {/* ============ BOOK WISDOM ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24">
        <SectionHeading
          eyebrow="Book Wisdom"
          title="Books That Build Better Men"
          blurb="We read the hard books so the lessons reach your life — deep breakdowns and real application."
          action={{ label: 'All Books', to: '/books' }}
        />
        <div className="grid md:grid-cols-2 gap-5">
          {books.slice(0, 2).map((b) => (
            <BookCard key={b.slug} book={b} />
          ))}
        </div>
      </section>

      {/* ============ MENTOR SPOTLIGHT ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24">
        <SectionHeading
          eyebrow="Mentor Spotlight"
          title="Mentors Worth Studying"
          blurb="Borrow decades of hard-won wisdom from the thinkers and builders who shaped strong men."
          action={{ label: 'All Mentors', to: '/mentors' }}
        />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {mentors.slice(0, 6).map((m) => (
            <MentorCard key={m.slug} mentor={m} compact />
          ))}
        </div>
      </section>

      {/* ============ VISION BOARD ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-24">
        <SectionHeading
          eyebrow="The Vision"
          title="Build the Life on Purpose"
          blurb="Focus. Strength. Clean fuel. Money. Learning. Leadership. A man’s vision board, made real one discipline at a time."
        />
        <VisionBoard />
      </section>

      {/* ============ MEMBERSHIP CTA ============ */}
      <MembershipCTA variant="band" />
    </Layout>
  );
}
