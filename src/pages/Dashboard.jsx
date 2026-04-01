import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame, Trophy, Target, BookOpen, TrendingUp } from 'lucide-react';
import QuoteCard from '../components/QuoteCard';
import HabitCard from '../components/HabitCard';
import { StreakMilestoneBar } from '../components/StreakBadge';
import { atomicQuotes, habitCategories } from '../data/quotes';
import {
  getTodayKey,
  getHabitData,
  toggleHabitForDate,
  isHabitCompleted,
  calculateStreak,
  getLongestStreak,
} from '../data/storage';

function StatCard({ icon: Icon, value, label, color = 'blue' }) {
  const colors = {
    blue:   'text-wb-blue-glow bg-wb-blue/10 border-wb-blue/20',
    gold:   'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    green:  'text-green-400 bg-green-400/10 border-green-400/20',
    purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  };
  return (
    <div className="wb-card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-wb-white">{value}</div>
        <div className="text-xs text-wb-muted">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard({ habitData, onToggleHabit }) {
  const today = getTodayKey();
  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Daily quote (cycles based on day of year)
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const dailyQuote = atomicQuotes[dayOfYear % atomicQuotes.length];

  const coreHabits = Object.values(habitCategories);

  const completedToday = coreHabits.filter(h =>
    isHabitCompleted(h.id, today, habitData)
  ).length;

  const stats = useMemo(() => {
    let totalStreak = 0;
    let totalLongest = 0;
    let totalDays = 0;

    coreHabits.forEach(h => {
      const dates = habitData[h.id]?.completedDates || [];
      totalStreak += calculateStreak(dates);
      totalLongest = Math.max(totalLongest, getLongestStreak(dates));
      totalDays += dates.length;
    });

    return { totalStreak, totalLongest, totalDays };
  }, [habitData]);

  // Progress ring
  const progressPct = (completedToday / coreHabits.length) * 100;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-wb-muted text-sm">{todayDate}</p>
          <h1 className="text-3xl font-bold text-wb-white mt-1">
            Welcome back, <span className="text-gradient-blue">Keith</span> 🏆
          </h1>
          <p className="text-wb-muted mt-1">
            {completedToday === coreHabits.length
              ? "All habits done today. You're unstoppable."
              : `${coreHabits.length - completedToday} habit${coreHabits.length - completedToday !== 1 ? 's' : ''} left today.`}
          </p>
        </div>
        {/* Progress ring */}
        <div className="flex items-center gap-4 wb-card p-5">
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="36" fill="none" stroke="#1e2d4a" strokeWidth="8" />
            <circle
              cx="44" cy="44" r="36"
              fill="none"
              stroke="#2563eb"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 44 44)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text x="44" y="48" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
              {completedToday}/{coreHabits.length}
            </text>
          </svg>
          <div>
            <div className="text-wb-white font-semibold">Today</div>
            <div className="text-wb-muted text-sm">{Math.round(progressPct)}% done</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Flame}     value={stats.totalStreak}  label="Combined Streak"  color="blue"   />
        <StatCard icon={Trophy}    value={stats.totalLongest} label="Longest Streak"   color="gold"   />
        <StatCard icon={Target}    value={completedToday}     label="Done Today"       color="green"  />
        <StatCard icon={TrendingUp} value={stats.totalDays}   label="Total Check-ins"  color="purple" />
      </div>

      {/* Daily quote */}
      <div>
        <h2 className="text-sm font-semibold text-wb-muted uppercase tracking-wider mb-3">
          Today's Quote
        </h2>
        <QuoteCard {...dailyQuote} variant="hero" />
      </div>

      {/* Today's habits quick-check */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-wb-white">Today's Habits</h2>
          <Link to="/tracker" className="wb-btn-ghost text-sm">
            Full tracker <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {coreHabits.map(habit => {
            const dates = habitData[habit.id]?.completedDates || [];
            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                isCompleted={isHabitCompleted(habit.id, today, habitData)}
                streak={calculateStreak(dates)}
                longestStreak={getLongestStreak(dates)}
                onToggle={() => onToggleHabit(habit.id)}
                showDetails={false}
              />
            );
          })}
        </div>
      </div>

      {/* CTA row */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/goals" className="wb-card p-6 group hover:border-wb-blue/40 transition-all duration-300">
          <Target className="w-8 h-8 text-wb-blue mb-3" />
          <h3 className="text-wb-white font-bold text-lg mb-1">Set a New Goal</h3>
          <p className="text-wb-muted text-sm">
            Tell us what you want to achieve. Get an Atomic Habits plan to make it happen.
          </p>
          <div className="flex items-center gap-1 text-wb-blue-glow text-sm mt-3 group-hover:gap-2 transition-all">
            Build your plan <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
        <Link to="/library" className="wb-card p-6 group hover:border-wb-blue/40 transition-all duration-300">
          <BookOpen className="w-8 h-8 text-wb-blue mb-3" />
          <h3 className="text-wb-white font-bold text-lg mb-1">Atomic Habits Library</h3>
          <p className="text-wb-muted text-sm">
            Master the four laws. Explore quotes, tactics, and principles from James Clear.
          </p>
          <div className="flex items-center gap-1 text-wb-blue-glow text-sm mt-3 group-hover:gap-2 transition-all">
            Explore library <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>
    </div>
  );
}
