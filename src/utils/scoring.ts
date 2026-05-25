import type { ScoreLabel } from '../types';

export function getScoreLabel(score: number): ScoreLabel {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'text-success';
  if (score >= 40) return 'text-gold';
  return 'text-danger';
}

export function scoreBg(score: number): string {
  if (score >= 70) return 'bg-success/10 border-success/30 text-success';
  if (score >= 40) return 'bg-gold/10 border-gold/30 text-gold-light';
  return 'bg-danger/10 border-danger/30 text-danger';
}

export function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-success';
  if (score >= 40) return 'bg-gold';
  return 'bg-danger';
}
