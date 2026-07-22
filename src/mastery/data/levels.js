// XP → Level progression. Ten named ranks with rising thresholds.
export const LEVELS = [
  { level: 1,  name: 'Observer',            min: 0 },
  { level: 2,  name: 'Initiator',           min: 300 },
  { level: 3,  name: 'Conversationalist',   min: 750 },
  { level: 4,  name: 'Connector',           min: 1400 },
  { level: 5,  name: 'Storyteller',         min: 2300 },
  { level: 6,  name: 'Influencer',          min: 3500 },
  { level: 7,  name: 'Leader',              min: 5000 },
  { level: 8,  name: 'Social Strategist',   min: 7000 },
  { level: 9,  name: 'Master Communicator', min: 9500 },
  { level: 10, name: 'Social Master',       min: 12500 },
]

export function levelForXp(xp) {
  let current = LEVELS[0]
  for (const l of LEVELS) if (xp >= l.min) current = l
  return current
}

export function levelProgress(xp) {
  const current = levelForXp(xp)
  const next = LEVELS.find(l => l.level === current.level + 1)
  if (!next) return { current, next: null, pct: 100, into: xp - current.min, span: 0 }
  const span = next.min - current.min
  const into = xp - current.min
  return { current, next, pct: Math.min(100, Math.round((into / span) * 100)), into, span }
}
