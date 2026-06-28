import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import PremiumGate from '../../components/PremiumGate';
import { MEALS, NUTRITION_ARTICLES } from '../../data/nutrition';
import type { MealCard, NutritionArticle } from '../../types';

// ─── Meal Detail ─────────────────────────────────────────────────────────────

function MealDetailView({ meal }: { meal: MealCard }) {
  const emojiMap: Record<string, string> = {
    breakfast: '🍳',
    lunch: '🥩',
    dinner: '🍽️',
    snack: '🥗',
    pre_workout: '⚡',
    post_workout: '💪',
  };
  const emoji = emojiMap[meal.category] ?? '🍴';
  const categoryLabel = meal.category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="pb-32">
      {/* Large Thumbnail */}
      <div
        className="h-52 w-full flex flex-col items-center justify-center gap-2"
        style={{
          background: 'linear-gradient(180deg, #0c1226 0%, #080b18 100%)',
        }}
      >
        <span className="text-5xl">{emoji}</span>
        <span className="eyebrow text-mist">{categoryLabel}</span>
      </div>

      {/* Tags Row */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto scrollbar-hide pb-1">
        <span className="chip flex-shrink-0">{categoryLabel}</span>
        <span className="chip-gold flex-shrink-0">{meal.calories} kcal</span>
        <span className="chip-blue flex-shrink-0">{meal.proteinG}g protein</span>
        <span className="chip flex-shrink-0">{meal.prep} prep</span>
      </div>

      {/* About This Meal */}
      <div className="px-4 mt-6">
        <h2 className="section-title mb-2">About This Meal</h2>
        <p className="text-sm text-chalk leading-relaxed">{meal.description}</p>
      </div>

      {/* Ingredients */}
      <div className="px-4 mt-6">
        <h2 className="section-title mb-3">Ingredients</h2>
        <ul className="flex flex-col gap-2">
          {meal.ingredients.map((ingredient, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-chalk leading-relaxed">
              <span
                className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                style={{ background: 'linear-gradient(135deg, #d4af37, #f0d060)' }}
              />
              {ingredient}
            </li>
          ))}
        </ul>
      </div>

      {/* Macros at a Glance */}
      <div className="px-4 mt-6">
        <h2 className="section-title mb-3">Macros at a Glance</h2>
        <div className="glass card-pad">
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-gradient-gold leading-none">{meal.calories}</span>
              <span className="text-[10px] text-mist mt-0.5">kcal</span>
              <span className="text-[10px] uppercase tracking-widest text-ghost mt-1">Cal</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-electric leading-none">{meal.proteinG}g</span>
              <span className="text-[10px] text-mist mt-0.5">grams</span>
              <span className="text-[10px] uppercase tracking-widest text-ghost mt-1">Protein</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-chalk leading-none">—</span>
              <span className="text-[10px] text-mist mt-0.5">grams</span>
              <span className="text-[10px] uppercase tracking-widest text-ghost mt-1">Carbs</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-chalk leading-none">—</span>
              <span className="text-[10px] text-mist mt-0.5">grams</span>
              <span className="text-[10px] uppercase tracking-widest text-ghost mt-1">Fat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prep Notes */}
      <div className="px-4 mt-6">
        <h2 className="section-title mb-2">Prep Notes</h2>
        <div
          className="rounded-2xl border border-ink-line p-4"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <p className="text-sm text-chalk leading-relaxed">{meal.prep}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Article Detail ──────────────────────────────────────────────────────────

function ArticleDetailView({ article }: { article: NutritionArticle }) {
  return (
    <div className="pb-32">
      {/* Category + Read Time */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto scrollbar-hide pb-1">
        <span className="chip flex-shrink-0">{article.category}</span>
        <span className="chip flex-shrink-0">{Math.ceil(article.readTimeSec / 60)} min read</span>
      </div>

      {/* Thumbnail */}
      <div
        className="h-44 w-full mx-0 mt-4 flex items-center justify-center"
        style={{
          background: 'linear-gradient(145deg, #0c1226 0%, #0f1635 50%, #080b18 100%)',
        }}
      >
        <span className="text-5xl">📖</span>
      </div>

      {/* Excerpt */}
      <div className="px-4 mt-5">
        <p className="text-chalk text-lg leading-relaxed italic">{article.excerpt}</p>
      </div>

      {/* Content Paragraphs */}
      <div className="px-4 mt-5">
        {article.content.map((paragraph, idx) => (
          <p key={idx} className="text-sm text-chalk leading-relaxed mb-4">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Divider */}
      <div className="px-4 mt-4">
        <div className="divider" />
      </div>

      {/* Footer */}
      <div className="px-4 mt-4 pb-4 flex items-center justify-center">
        <p className="text-xs text-ghost text-center">Designed by Winners Bookmark Incorporated</p>
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function NutritionDetailScreen() {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Resolve content: check MEALS first, then NUTRITION_ARTICLES
  const meal = MEALS.find(m => m.id === contentId) ?? null;
  const article = !meal
    ? NUTRITION_ARTICLES.find(a => a.id === contentId) ?? null
    : null;

  // Not found
  if (!meal && !article) {
    return (
      <div className="page pb-32">
        <ScreenHeader title="Not Found" showBack={true} />
        <div className="px-4 mt-12 flex flex-col items-center gap-4">
          <p className="text-mist text-sm text-center">
            This content could not be found.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="btn-ghost"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Meal detail
  if (meal) {
    const isPremiumLocked = meal.isPremium && user?.isPremium === false;

    return (
      <div className="page">
        <ScreenHeader title={meal.name} showBack={true} />
        {isPremiumLocked ? (
          <div className="px-4 mt-4">
            <PremiumGate feature={meal.name} />
          </div>
        ) : (
          <MealDetailView meal={meal} />
        )}
      </div>
    );
  }

  // Article detail
  if (article) {
    const isPremiumLocked = article.isPremium && user?.isPremium === false;

    return (
      <div className="page">
        <ScreenHeader
          title={article.title}
          showBack={true}
          eyebrow={article.category}
        />
        {isPremiumLocked ? (
          <div className="px-4 mt-4">
            <PremiumGate feature={article.title} />
          </div>
        ) : (
          <ArticleDetailView article={article} />
        )}
      </div>
    );
  }

  return null;
}
