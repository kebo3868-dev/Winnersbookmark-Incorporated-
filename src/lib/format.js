// Small formatting helpers shared across the site.

export function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function readingLabel(minutes) {
  return `${minutes} min read`;
}

// Maps a category/book/mentor `accent` token to a consistent set of classes.
export const accentClasses = {
  gold: {
    text: 'text-gold-light',
    border: 'border-gold/40',
    bg: 'bg-gold/10',
    glow: 'from-gold/25',
    chip: 'chip-gold',
    grad: 'from-gold/20 via-ink-card to-ink-card',
  },
  electric: {
    text: 'text-electric-glow',
    border: 'border-electric/40',
    bg: 'bg-electric/10',
    glow: 'from-electric/25',
    chip: 'chip-blue',
    grad: 'from-electric/20 via-ink-card to-ink-card',
  },
  crimson: {
    text: 'text-[#f08a8a]',
    border: 'border-[#7f1d1d]/50',
    bg: 'bg-[#7f1d1d]/15',
    glow: 'from-[#b91c1c]/25',
    chip: 'chip',
    grad: 'from-[#7f1d1d]/25 via-ink-card to-ink-card',
  },
  success: {
    text: 'text-success',
    border: 'border-success/40',
    bg: 'bg-success/10',
    glow: 'from-success/25',
    chip: 'chip',
    grad: 'from-success/20 via-ink-card to-ink-card',
  },
};

export const accent = (key) => accentClasses[key] || accentClasses.gold;
