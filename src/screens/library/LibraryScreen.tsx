import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import ScreenHeader from '../../components/ScreenHeader';
import PremiumGate from '../../components/PremiumGate';
import { EXERCISES } from '../../data/exercises';
import { PROGRAMS } from '../../data/programs';
import { NUTRITION_ARTICLES } from '../../data/nutrition';
import { TESTO_CARDS } from '../../data/testosterone';

// ─── Types ───────────────────────────────────────────────────────────────────

type LibraryCategory = 'exercise' | 'workout' | 'nutrition' | 'testosterone';

type LibraryItem = {
  id: string;
  title: string;
  category: LibraryCategory;
  description: string;
  isPremium: boolean;
  route: string;
};

// ─── Category Tab Config ──────────────────────────────────────────────────────

const TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'All' },
  { label: 'Exercises', value: 'Exercises' },
  { label: 'Programs', value: 'Programs' },
  { label: 'Nutrition', value: 'Nutrition' },
  { label: 'Testosterone', value: 'Testosterone' },
];

const TAB_TO_CATEGORY: Record<string, LibraryCategory> = {
  Exercises: 'exercise',
  Programs: 'workout',
  Nutrition: 'nutrition',
  Testosterone: 'testosterone',
};

// ─── Chip classes per category ────────────────────────────────────────────────

function getCategoryChipClass(category: LibraryCategory): string {
  switch (category) {
    case 'exercise':
      return 'chip-gold';
    case 'workout':
      return 'chip-blue';
    default:
      return 'chip';
  }
}

function getCategoryLabel(category: LibraryCategory): string {
  switch (category) {
    case 'exercise':
      return 'Exercise';
    case 'workout':
      return 'Program';
    case 'nutrition':
      return 'Nutrition';
    case 'testosterone':
      return 'Testosterone';
    default:
      return category;
  }
}

// ─── Item Card Component ──────────────────────────────────────────────────────

interface LibraryItemCardProps {
  item: LibraryItem;
  isSaved: boolean;
  onTap: () => void;
  onToggleSave: (e: React.MouseEvent) => void;
}

function LibraryItemCard({ item, isSaved, onTap, onToggleSave }: LibraryItemCardProps) {
  return (
    <div
      className="glass card-pad mb-2 cursor-pointer active:opacity-80 transition-opacity"
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onTap()}
    >
      <div className="flex items-start gap-3">
        {/* Category chip */}
        <div className="shrink-0 pt-0.5">
          <span className={getCategoryChipClass(item.category)}>
            {getCategoryLabel(item.category)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-paper leading-snug">{item.title}</p>
          <p
            className="text-ghost text-sm mt-0.5"
            style={{
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.description}
          </p>
        </div>

        {/* Right icons */}
        <div className="shrink-0 flex items-center gap-2 pl-1">
          {item.isPremium && (
            <span className="text-ghost text-base" title="Premium content">
              🔒
            </span>
          )}
          <button
            onClick={onToggleSave}
            className="icon-btn p-1"
            aria-label={isSaved ? 'Remove bookmark' : 'Bookmark this item'}
          >
            <svg
              className={`w-5 h-5 ${isSaved ? 'text-gold' : 'text-ghost'}`}
              fill={isSaved ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { appState, toggleSaved, addRecentlyViewed } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);

  // ─── Build combined items from all data sources ───────────────────────────

  const combinedItems = useMemo<LibraryItem[]>(() => {
    const exerciseItems: LibraryItem[] = EXERCISES.map((ex) => ({
      id: ex.id,
      title: ex.name,
      category: 'exercise',
      description: ex.muscleGroup,
      isPremium: ex.isPremium,
      route: `/exercises/${ex.id}`,
    }));

    const programItems: LibraryItem[] = PROGRAMS.map((prog) => ({
      id: prog.id,
      title: prog.name,
      category: 'workout',
      description: prog.description,
      isPremium: prog.isPremium,
      route: `/program/${prog.id}`,
    }));

    const nutritionItems: LibraryItem[] = NUTRITION_ARTICLES.map((article) => ({
      id: article.id,
      title: article.title,
      category: 'nutrition',
      description: article.excerpt,
      isPremium: article.isPremium,
      route: `/nutrition/article/${article.id}`,
    }));

    const testoItems: LibraryItem[] = TESTO_CARDS.map((card) => ({
      id: card.id,
      title: card.title,
      category: 'testosterone',
      description: card.excerpt,
      isPremium: card.isPremium,
      route: `/testosterone/detail/${card.id}`,
    }));

    return [...exerciseItems, ...programItems, ...nutritionItems, ...testoItems];
  }, []);

  // ─── Filtered items ───────────────────────────────────────────────────────

  const filteredItems = useMemo<LibraryItem[]>(() => {
    let items = [...combinedItems];

    // Filter by category tab
    if (selectedCategory !== 'All') {
      const categoryValue = TAB_TO_CATEGORY[selectedCategory];
      if (categoryValue) {
        items = items.filter((item) => item.category === categoryValue);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
      );
    }

    // Filter by saved only
    if (savedOnly) {
      items = items.filter((item) => appState.savedItemIds.includes(item.id));
    }

    return items;
  }, [combinedItems, selectedCategory, searchQuery, savedOnly, appState.savedItemIds]);

  // ─── Recently viewed items (ordered by recentlyViewedIds) ─────────────────

  const recentlyViewedItems = useMemo<LibraryItem[]>(() => {
    const itemMap = new Map(combinedItems.map((item) => [item.id, item]));
    return appState.recentlyViewedIds
      .slice(0, 5)
      .map((id) => itemMap.get(id))
      .filter((item): item is LibraryItem => item !== undefined);
  }, [combinedItems, appState.recentlyViewedIds]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleItemTap(item: LibraryItem) {
    addRecentlyViewed(item.id);
    navigate(item.route);
  }

  function handleToggleSave(e: React.MouseEvent, itemId: string) {
    e.stopPropagation();
    toggleSaved(itemId);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const showRecentlyViewed = !searchQuery.trim() && !savedOnly;

  return (
    <div className="page">
      <ScreenHeader
        title="Library"
        rightAction={
          <button
            onClick={() => setSavedOnly(!savedOnly)}
            className={`icon-btn ${savedOnly ? 'text-gold' : 'text-ghost'}`}
            aria-label={savedOnly ? 'Show all items' : 'Show saved items only'}
          >
            <svg
              className="w-5 h-5"
              fill={savedOnly ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
              />
            </svg>
          </button>
        }
      />

      <div className="px-4 pt-4">
        {/* ─── Search Bar ─────────────────────────────────────────────────── */}
        <div className="relative glass rounded-xl mb-4">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ghost pointer-events-none">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search exercises, plans, nutrition..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-paper placeholder-ghost text-sm pl-9 pr-10 py-3 rounded-xl outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ghost hover:text-paper transition-colors"
              aria-label="Clear search"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* ─── Category Tabs ──────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedCategory(tab.value)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedCategory === tab.value
                  ? 'bg-gold text-ink-black'
                  : 'bg-ink-panel text-ghost border border-ink-line hover:text-paper'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Results List ────────────────────────────────────────────────── */}
        {filteredItems.length === 0 ? (
          <div className="empty">
            {savedOnly && !searchQuery.trim()
              ? 'No saved items yet. Bookmark content to see it here.'
              : searchQuery.trim()
              ? `No results for "${searchQuery}"`
              : 'No items found.'}
          </div>
        ) : (
          <div>
            {filteredItems.map((item) => (
              <LibraryItemCard
                key={item.id}
                item={item}
                isSaved={appState.savedItemIds.includes(item.id)}
                onTap={() => handleItemTap(item)}
                onToggleSave={(e) => handleToggleSave(e, item.id)}
              />
            ))}
          </div>
        )}

        {/* ─── Recently Viewed ─────────────────────────────────────────────── */}
        {showRecentlyViewed && (
          <div className="mt-6">
            <h2 className="section-title mb-3">Recently Viewed</h2>
            {recentlyViewedItems.length === 0 ? (
              <p className="text-ghost text-sm">Nothing viewed yet.</p>
            ) : (
              <div>
                {recentlyViewedItems.map((item) => (
                  <LibraryItemCard
                    key={item.id}
                    item={item}
                    isSaved={appState.savedItemIds.includes(item.id)}
                    onTap={() => handleItemTap(item)}
                    onToggleSave={(e) => handleToggleSave(e, item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom padding */}
        <div className="pb-32" />
      </div>
    </div>
  );
}
