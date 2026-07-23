// Onboarding assessment. Answers feed a baseline skill profile + a 30-day path.
export const GOALS = [
  { key: 'confidence',       label: 'Confidence' },
  { key: 'conversation',     label: 'Conversation' },
  { key: 'friends',          label: 'Making friends' },
  { key: 'dating',           label: 'Dating' },
  { key: 'networking',       label: 'Networking' },
  { key: 'publicSpeaking',   label: 'Public speaking' },
  { key: 'leadership',       label: 'Leadership' },
  { key: 'relationships',    label: 'Relationships' },
  { key: 'anxiety',          label: 'Social anxiety' },
  { key: 'bodyLanguage',     label: 'Body language' },
]

export const HARD_SITUATIONS = [
  { key: 'meeting',   label: 'Meeting new people' },
  { key: 'groups',    label: 'Group conversations' },
  { key: 'dating',    label: 'Dating' },
  { key: 'events',    label: 'Networking events' },
  { key: 'speaking',  label: 'Speaking publicly' },
  { key: 'flow',      label: 'Keeping conversations flowing' },
  { key: 'approach',  label: 'Approaching someone' },
  { key: 'rejection', label: 'Handling rejection' },
  { key: 'boundaries',label: 'Setting boundaries' },
  { key: 'conflict',  label: 'Conflict' },
]

export const PACES = [
  { key: '5',  label: '5 min / day',  goal: 1 },
  { key: '10', label: '10 min / day', goal: 2 },
  { key: '15', label: '15 min / day', goal: 3 },
  { key: '20', label: '20+ min / day', goal: 4 },
]

// Which tracked skill each answer nudges downward (a growth area) in the baseline.
const GOAL_TO_SKILL = {
  confidence: 'confidence', conversation: 'conversation', friends: 'emotionalIntelligence',
  dating: 'dating', networking: 'networking', publicSpeaking: 'publicSpeaking',
  leadership: 'leadership', relationships: 'relationships', anxiety: 'confidence',
  bodyLanguage: 'presence',
}
const SIT_TO_SKILL = {
  meeting: 'conversation', groups: 'presence', dating: 'dating', events: 'networking',
  speaking: 'publicSpeaking', flow: 'conversation', approach: 'confidence',
  rejection: 'confidence', boundaries: 'relationships', conflict: 'relationships',
}

// Build a 0-100 baseline per tracked skill from assessment answers.
export function buildBaseline({ goals = [], comfort = 3, hardest = [], allSkills }) {
  const base = {}
  // Comfort (1-5) sets the general floor; lower comfort → lower baseline.
  const floor = 34 + (comfort - 1) * 8 // 34..66
  allSkills.forEach(s => { base[s.key] = floor + Math.round((Math.random() * 0 + s.key.length % 5)) }) // slight, stable variation
  // Growth areas the user flagged sit a bit lower (more room to grow).
  goals.forEach(g => { const k = GOAL_TO_SKILL[g]; if (k) base[k] = Math.max(15, base[k] - 14) })
  hardest.forEach(h => { const k = SIT_TO_SKILL[h]; if (k) base[k] = Math.max(12, base[k] - 10) })
  // Listening & emotional IQ track roughly with comfort.
  base.listening = Math.min(base.listening, floor + 4)
  allSkills.forEach(s => { base[s.key] = Math.max(12, Math.min(88, base[s.key])) })
  return base
}

// Order the academies into a 30-day-flavored path led by the user's goals.
export function buildPath(goals = []) {
  const priority = {
    confidence: ['a1', 'a3'], conversation: ['a2', 'a3'], friends: ['a6', 'a2'],
    dating: ['a8', 'a1'], networking: ['a7', 'a2'], publicSpeaking: ['a10', 'a3'],
    leadership: ['a11', 'a12'], relationships: ['a9', 'a12'], anxiety: ['a1', 'a4'],
    bodyLanguage: ['a4', 'a3'],
  }
  const order = []
  goals.forEach(g => (priority[g] || []).forEach(id => { if (!order.includes(id)) order.push(id) }))
  // Always start grounded if nothing else pulled it in.
  if (!order.includes('a1')) order.unshift('a1')
  if (!order.includes('a2')) order.splice(1, 0, 'a2')
  return order
}
