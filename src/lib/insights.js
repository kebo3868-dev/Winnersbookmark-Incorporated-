export function detectDrift(entries, thoughts) {
  const alerts = [];
  const entryKeys = Object.keys(entries).sort().reverse();

  // Check for repeated unresolved issues
  if (thoughts && thoughts.length >= 3) {
    const recentThoughts = thoughts.slice(-5);
    const issueWords = {};
    recentThoughts.forEach(t => {
      const words = (t.realIssue || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
      words.forEach(w => { issueWords[w] = (issueWords[w] || 0) + 1; });
    });
    const repeated = Object.entries(issueWords).filter(([, c]) => c >= 3);
    if (repeated.length > 0) {
      alerts.push({
        type: 'repeated_issue',
        message: "You've written about the same issue repeatedly. What decision are you avoiding?",
        severity: 'high'
      });
    }
  }

  // Check for priority changes
  const recentEntries = entryKeys.slice(0, 7).map(k => entries[k]).filter(Boolean);
  const prioritySets = recentEntries.map(e => (e.morning?.priorities || []).join('|')).filter(Boolean);
  const uniquePriorities = new Set(prioritySets);
  if (uniquePriorities.size >= 5 && prioritySets.length >= 5) {
    alerts.push({
      type: 'shifting_priorities',
      message: "Your priorities are changing more than your behavior.",
      severity: 'medium'
    });
  }

  // Check for low alignment scores
  const recentScores = recentEntries.map(e => e.evening?.alignmentScore).filter(s => s != null);
  if (recentScores.length >= 3) {
    const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    if (avg < 4) {
      alerts.push({
        type: 'low_alignment',
        message: "Your alignment scores suggest a disconnect between your goals and your daily actions.",
        severity: 'high'
      });
    }
  }

  // Check for missing entries (inconsistency)
  if (entryKeys.length >= 7) {
    let gaps = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (!entries[key]) gaps++;
    }
    if (gaps >= 4) {
      alerts.push({
        type: 'inconsistent',
        message: "Consistency is the compound interest of self-improvement. You've missed most days this week.",
        severity: 'medium'
      });
    }
  }

  return alerts;
}

export function computeWeeklyStats(entries) {
  const stats = { completed: 0, total: 7, avgScore: 0, bestDay: null, worstDay: null };
  let scores = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = entries[key];
    if (entry && (entry.morning || entry.evening)) {
      stats.completed++;
      const score = entry.evening?.alignmentScore;
      if (score != null) {
        scores.push({ key, score });
      }
    }
  }

  if (scores.length > 0) {
    stats.avgScore = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length);
    scores.sort((a, b) => b.score - a.score);
    stats.bestDay = scores[0]?.key;
    stats.worstDay = scores[scores.length - 1]?.key;
  }

  return stats;
}
