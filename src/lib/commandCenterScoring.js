export const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

export function dailyScore(items = []) {
  if (!items.length) return 0;
  const done = items.filter((i) => i.completed).length;
  return Math.round((done / items.length) * 100);
}

export function dailyLabel(score) {
  if (score <= 30) return 'Drift Mode';
  if (score <= 60) return 'Building Mode';
  if (score <= 85) return 'Strong Day';
  return 'Black Flame Day';
}

export const weeklyContentTarget = (items = []) => {
  const shorts = items.filter((x) => ['TikTok', 'Instagram', 'YouTube Shorts'].includes(x.platform)).length;
  const carousel = items.filter((x) => x.type === 'carousel').length;
  const long = items.filter((x) => ['YouTube', 'Blog', 'Email Newsletter'].includes(x.platform)).length;
  return { shorts, carousel, long };
};
