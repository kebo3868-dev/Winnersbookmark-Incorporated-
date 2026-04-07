const SCORE_CATEGORIES = ['focus', 'discipline', 'courage', 'health', 'output', 'alignment', 'peace'];

export { SCORE_CATEGORIES };

export function computeAlignmentScore(scores) {
  if (!scores || Object.keys(scores).length === 0) return 0;
  const vals = SCORE_CATEGORIES.map(c => scores[c] || 0);
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round(sum / SCORE_CATEGORIES.length);
}

export function getScoreLabel(score) {
  if (score >= 9) return 'Elite';
  if (score >= 7) return 'Strong';
  if (score >= 5) return 'Moderate';
  if (score >= 3) return 'Drifting';
  return 'Critical';
}

export function getScoreColor(score) {
  if (score >= 9) return 'text-green-400';
  if (score >= 7) return 'text-wb-blue-light';
  if (score >= 5) return 'text-wb-gold';
  if (score >= 3) return 'text-orange-400';
  return 'text-red-400';
}

export function getScoreBgColor(score) {
  if (score >= 9) return 'bg-green-400/10 border-green-400/20';
  if (score >= 7) return 'bg-wb-blue/10 border-wb-blue/20';
  if (score >= 5) return 'bg-wb-gold/10 border-wb-gold/20';
  if (score >= 3) return 'bg-orange-400/10 border-orange-400/20';
  return 'bg-red-400/10 border-red-400/20';
}
