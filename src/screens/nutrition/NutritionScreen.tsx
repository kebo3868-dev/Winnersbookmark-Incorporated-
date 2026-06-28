import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import ScreenHeader from '../../components/ScreenHeader';
import { MEALS, NUTRITION_ARTICLES, NUTRITION_CATEGORIES } from '../../data/nutrition';
import type { MealCard, NutritionArticle } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function categoryToFilter(cat: string): string {
  return cat.toLowerCase().replace('-', '_').replace(' ', '_');
}

function mealMatchesCategory(meal: MealCard, activeCategory: string): boolean {
  if (activeCategory === 'All') return true;
  const normalized = activeCategory.toLowerCase().replace('-', '_').replace(' ', '_');
  return meal.category === normalized;
}

// ─── Macro Stat Card ────────────────────────────────────────────────────────

function MacroStatCard({
  value,
  unit,
  label,
  valueColor,
}: {
  value: number;
  unit: string;
  label: string;
  valueColor: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center p-3 rounded-2xl border border-ink-line"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
      }}
    >
      <span className={`text-2xl font-black leading-none ${valueColor}`}>{value}</span>
      <span className="text-[10px] font-semibold text-mist mt-0.5">{unit}</span>
      <span className="text-[10px] uppercase tracking-widest text-ghost mt-1">{label}</span>
    </div>
  );
}

// ─── Meal Grid Card ─────────────────────────────────────────────────────────

function MealGridCard({ meal, onClick }: { meal: MealCard; onClick: () => void }) {
  const emojiMap: Record<string, string> = {
    breakfast: '🍳',
    lunch: '🥩',
    dinner: '🍽️',
    snack: '🥗',
    pre_workout: '⚡',
    post_workout: '💪',
  };
  const emoji = emojiMap[meal.category] ?? '🍴';

  return (
    <button
      onClick={onClick}
      className="glass flex flex-col overflow-hidden active:scale-[.97] transition-all duration-200 text-left w-full"
    >
      {/* Thumbnail */}
      <div
        className="h-28 w-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(145deg, #0c1226 0%, #080b18 100%)',
        }}
      >
        <span className="text-3xl">{emoji}</span>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2">
        <p className="text-xs font-bold text-paper leading-snug line-clamp-2">{meal.name}</p>

        <div className="flex flex-wrap gap-1">
          <span className="chip-gold text-[10px]">{meal.calories} kcal</span>
          <span className="chip-blue text-[10px]">{meal.proteinG}g protein</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="label text-ghost">{meal.prep}</span>
          <span className="chip text-[10px]">{meal.category.replace('_', ' ')}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Article Card (horizontal) ───────────────────────────────────────────────

function ArticleScrollCard({
  article,
  onClick,
}: {
  article: NutritionArticle;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass w-48 flex-shrink-0 flex flex-col overflow-hidden active:scale-[.97] transition-all duration-200 text-left"
    >
      {/* Thumbnail */}
      <div
        className="h-24 w-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(145deg, #0c1226 0%, #0f1635 50%, #080b18 100%)',
        }}
      >
        <span className="text-2xl">📖</span>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5">
        <p className="text-xs font-bold text-paper leading-snug line-clamp-2">{article.title}</p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="chip text-[10px]">{article.category}</span>
        </div>
        <span className="label text-ghost">{Math.ceil(article.readTimeSec / 60)} min read</span>
      </div>
    </button>
  );
}

// ─── Quick Guide Row ─────────────────────────────────────────────────────────

function QuickGuideRow({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass card-pad flex items-center gap-4 w-full active:scale-[.98] transition-all duration-200 text-left"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: 'rgba(212,175,55,0.12)',
          border: '1px solid rgba(212,175,55,0.25)',
        }}
      >
        <span className="text-gold text-sm">▶</span>
      </div>
      <span className="flex-1 text-sm font-semibold text-paper">{title}</span>
      <svg
        className="w-4 h-4 text-ghost shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const navigate = useNavigate();
  const { appState } = useApp();
  const { nutritionTargets } = appState;

  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filteredMeals = MEALS.filter(meal => mealMatchesCategory(meal, activeCategory));

  const quickGuides = [
    { title: 'What to Eat More Of', route: '/nutrition/article/art_what_to_eat_more' },
    { title: 'Easy Meal Prep', route: '/nutrition/article/art_meal_prep' },
    { title: 'Eating Out Smarter', route: '/nutrition/article/art_eating_out' },
    { title: 'Supplements: What Works', route: '/nutrition/article/art_supplements' },
  ];

  return (
    <div className="page pb-32">
      <ScreenHeader title="Nutrition" />

      {/* ── A) MACRO TARGETS CARD ───────────────────────────────────────── */}
      <div className="px-4 mt-4">
        <div className="glass card-pad">
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow">Daily Targets</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <MacroStatCard
              value={nutritionTargets.calories}
              unit="kcal"
              label="Calories"
              valueColor="text-gradient-gold"
            />
            <MacroStatCard
              value={nutritionTargets.proteinG}
              unit="grams"
              label="Protein"
              valueColor="text-electric"
            />
            <MacroStatCard
              value={nutritionTargets.carbsG}
              unit="grams"
              label="Carbs"
              valueColor="text-chalk"
            />
            <MacroStatCard
              value={nutritionTargets.fatG}
              unit="grams"
              label="Fat"
              valueColor="text-chalk"
            />
          </div>

          <div className="mt-3 pt-3 border-t border-ink-line flex justify-center">
            <span className="chip text-xs text-mist">💧 Hydration: Target 3.5L daily</span>
          </div>
        </div>
      </div>

      {/* ── B) CATEGORY FILTER ROW ──────────────────────────────────────── */}
      <div className="mt-5">
        <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide pb-1">
          {NUTRITION_CATEGORIES.map(cat => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={[
                  'flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200',
                  isActive
                    ? 'border-gold text-gold bg-gold/10'
                    : 'border-ink-line text-ghost bg-transparent hover:border-ink-edge hover:text-chalk',
                ].join(' ')}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── C) MEAL CARDS GRID ──────────────────────────────────────────── */}
      <div className="px-4 mt-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="eyebrow">Meals</span>
          <div className="flex-1 h-px bg-ink-line" />
          <span className="label text-ghost">{filteredMeals.length} options</span>
        </div>

        {filteredMeals.length === 0 ? (
          <div className="empty">
            <p className="text-mist text-sm">No meals in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredMeals.map(meal => (
              <MealGridCard
                key={meal.id}
                meal={meal}
                onClick={() => navigate(`/nutrition/article/${meal.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── D) NUTRITION EDUCATION SECTION ──────────────────────────────── */}
      <div className="mt-8">
        <div className="px-4 mb-3">
          <h2 className="section-title">Fuel Your Goals</h2>
          <p className="text-xs text-mist mt-0.5">Evidence-based nutrition for men who train.</p>
        </div>

        <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-1">
          {NUTRITION_ARTICLES.map(article => (
            <ArticleScrollCard
              key={article.id}
              article={article}
              onClick={() => navigate(`/nutrition/article/${article.id}`)}
            />
          ))}
        </div>
      </div>

      {/* ── E) QUICK GUIDES SECTION ─────────────────────────────────────── */}
      <div className="px-4 mt-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="section-title">Quick Guides</h2>
          <div className="flex-1 h-px bg-ink-line" />
        </div>

        <div className="flex flex-col gap-2.5">
          {quickGuides.map(guide => (
            <QuickGuideRow
              key={guide.route}
              title={guide.title}
              onClick={() => navigate(guide.route)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
