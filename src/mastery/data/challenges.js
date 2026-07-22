// Real-world missions across four difficulty tiers. The daily challenge is
// chosen deterministically from the day so it's stable across a session.
export const CHALLENGES = [
  // EASY
  { id: 'c-eye-smile', tier: 'Easy',  xp: 30, skill: 'confidence',
    text: 'Make eye contact and smile at three different people today.',
    prompt: 'How did it feel — and did anyone smile back?' },
  { id: 'c-say-hi', tier: 'Easy', xp: 30, skill: 'confidence',
    text: 'Say hello to someone first, before they greet you.',
    prompt: 'What did you notice about who moves first in a greeting?' },
  { id: 'c-compliment', tier: 'Easy', xp: 35, skill: 'emotionalIntelligence',
    text: 'Give one genuine, specific compliment to someone.',
    prompt: 'Was it about a choice they made, not just how they look?' },
  { id: 'c-small-talk', tier: 'Easy', xp: 35, skill: 'conversation',
    text: 'Exchange one friendly line with a cashier, barista, or stranger.',
    prompt: 'What tiny opener worked for you?' },

  // MEDIUM
  { id: 'c-2min', tier: 'Medium', xp: 60, skill: 'conversation',
    text: 'Start a 2-minute conversation with someone you normally wouldn’t speak to.',
    prompt: 'What did you learn about them that surprised you?' },
  { id: 'c-open-q', tier: 'Medium', xp: 55, skill: 'conversation',
    text: 'Ask someone one open-ended question and follow up on their answer.',
    prompt: 'Which follow-up opened things up the most?' },
  { id: 'c-name', tier: 'Medium', xp: 55, skill: 'networking',
    text: 'Learn and use one new person’s name in conversation.',
    prompt: 'What trick helped you remember it?' },
  { id: 'c-story', tier: 'Medium', xp: 65, skill: 'storytelling',
    text: 'Tell a short story with a clear setup and payoff to someone today.',
    prompt: 'Where did they lean in — and where did you lose them?' },

  // HARD
  { id: 'c-solo-event', tier: 'Hard', xp: 110, skill: 'confidence',
    text: 'Attend a social event alone and stay at least 30 minutes.',
    prompt: 'What was the hardest moment, and how did you get through it?' },
  { id: 'c-intro-three', tier: 'Hard', xp: 120, skill: 'networking',
    text: 'Introduce yourself to three new people at one gathering.',
    prompt: 'Which introduction felt best, and why?' },
  { id: 'c-speak-up', tier: 'Hard', xp: 100, skill: 'leadership',
    text: 'Speak up with an idea or opinion in a group setting.',
    prompt: 'What did you fear would happen — and what actually happened?' },
  { id: 'c-ask', tier: 'Hard', xp: 110, skill: 'dating',
    text: 'Make a real ask where “no” is possible (an invite, a request, a date).',
    prompt: 'How did you handle the answer you got?' },

  // ELITE
  { id: 'c-present', tier: 'Elite', xp: 200, skill: 'publicSpeaking',
    text: 'Give a short presentation or toast to a group.',
    prompt: 'What landed, and what will you refine next time?' },
  { id: 'c-host', tier: 'Elite', xp: 220, skill: 'emotionalIntelligence',
    text: 'Host a small social gathering and make everyone feel welcome.',
    prompt: 'How did you help people connect with each other?' },
  { id: 'c-network-five', tier: 'Elite', xp: 240, skill: 'networking',
    text: 'Attend a networking event and make five genuine connections.',
    prompt: 'Which connection has the most potential, and how will you follow up?' },
]

export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map(c => [c.id, c]))
export const TIERS = ['Easy', 'Medium', 'Hard', 'Elite']
export const TIER_META = {
  Easy:   { color: 'success', order: 0 },
  Medium: { color: 'amber',   order: 1 },
  Hard:   { color: 'gold',    order: 2 },
  Elite:  { color: 'danger',  order: 3 },
}

// Deterministic daily pick from the Easy/Medium pool (keeps momentum realistic).
export function dailyChallenge(dateStr) {
  const pool = CHALLENGES.filter(c => c.tier === 'Easy' || c.tier === 'Medium')
  let h = 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}
