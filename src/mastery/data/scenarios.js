// AI Social Coach — role-play scenarios + a local mock conversation engine.
//
// INTEGRATION POINT: replaceMockReply() below is where a production model
// (e.g. the Claude Messages API via a server route) should be wired in. Keep
// the persona + rubric shape so scoring and UI stay unchanged. Never put an
// API key in client code — call your own backend endpoint instead.

export const SCENARIOS = [
  { id: 's-coffee', icon: 'Coffee', title: 'Coffee Shop', persona: 'Jordan',
    difficulty: 'Warm-up', skill: 'conversation',
    setting: 'You’re both waiting for your order. Jordan is friendly but a little reserved.',
    goal: 'Start a light, natural conversation and find one thing in common.',
    opener: 'Oh — sorry, I think that’s my drink they just called. Long line today, huh?' },
  { id: 's-network', icon: 'Handshake', title: 'Networking Event', persona: 'Priya',
    difficulty: 'Standard', skill: 'networking',
    setting: 'A busy industry mixer. Priya is a senior person you’d love to know.',
    goal: 'Introduce yourself, give value, and open a door to follow up.',
    opener: 'Hi there — I don’t think we’ve met. Are you enjoying the event so far?' },
  { id: 's-date', icon: 'Heart', title: 'First Date', persona: 'Alex',
    difficulty: 'Standard', skill: 'dating',
    setting: 'A relaxed first date at a wine bar. Alex is warm but a bit nervous too.',
    goal: 'Build genuine connection without interviewing — trade stories, stay present.',
    opener: 'I’m so glad we finally did this. I was a little nervous, honestly — were you?' },
  { id: 's-interview', icon: 'Briefcase', title: 'Job Interview', persona: 'Mr. Reyes',
    difficulty: 'Standard', skill: 'leadership',
    setting: 'A final-round interview. Mr. Reyes is professional and evaluates clarity.',
    goal: 'Communicate with calm confidence and clear, structured answers.',
    opener: 'Thanks for coming in. So, tell me a little about yourself and why this role?' },
  { id: 's-coworker', icon: 'AlertTriangle', title: 'Difficult Coworker', persona: 'Sam',
    difficulty: 'Challenging', skill: 'relationships',
    setting: 'Sam missed a shared deadline and is defensive. You need to address it.',
    goal: 'Raise the issue calmly, without blame, and reach a path forward.',
    opener: 'Look, before you say anything — it wasn’t just me, okay? Everyone was slammed.' },
  { id: 's-raise', icon: 'TrendingUp', title: 'Asking for a Raise', persona: 'Dana',
    difficulty: 'Challenging', skill: 'leadership',
    setting: 'Your manager Dana is fair but budget-conscious.',
    goal: 'Make a confident, evidence-based case without apologizing for asking.',
    opener: 'Sure, I’ve got a few minutes. What did you want to talk about?' },
  { id: 's-friend', icon: 'Users', title: 'Making a New Friend', persona: 'Casey',
    difficulty: 'Warm-up', skill: 'emotionalIntelligence',
    setting: 'You keep seeing Casey at the gym. Today you finally say more than hi.',
    goal: 'Move from acquaintance to a real connection — and set up a next time.',
    opener: 'Hey! You’re here early too, huh? I swear I see you every Tuesday.' },
  { id: 's-reject', icon: 'ShieldOff', title: 'Handling Rejection', persona: 'Riley',
    difficulty: 'Challenging', skill: 'dating',
    setting: 'You asked Riley out; they’re about to gently decline.',
    goal: 'Receive a “no” with grace and keep your composure and dignity.',
    opener: 'Hey, I really appreciate you asking… but I think I see us more as friends. I hope that’s okay?' },
]

export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map(s => [s.id, s]))

// --- Heuristic mock reply engine ------------------------------------------
const OPEN_HINTS = ['what', 'how', 'why', 'tell me', 'what’s', 'whats', 'which', 'when', 'where']
const EMPATHY = ['understand', 'that makes sense', 'i hear', 'sounds', 'appreciate', 'must be', 'fair', 'sorry', 'thank']

function features(text) {
  const t = text.toLowerCase().trim()
  return {
    words: t ? t.split(/\s+/).length : 0,
    asksQuestion: /\?/.test(text) || OPEN_HINTS.some(h => t.startsWith(h)),
    openQuestion: OPEN_HINTS.some(h => t.includes(h)) && /\?/.test(text),
    empathy: EMPATHY.some(e => t.includes(e)),
    veryShort: t.split(/\s+/).length <= 2,
    aboutThem: /\byou\b|\byour\b/.test(t),
  }
}

const REPLIES = {
  warm: [
    'Ha, yeah! That actually happens to me a lot. What about you — regular here?',
    'Oh nice, I like that. Honestly I don’t meet many people who ask that. So what’s your story?',
    'That’s a good question — let me think. I guess the honest answer is I’m still figuring it out. You?',
    'I appreciate you asking, genuinely. Most people just talk about themselves.',
  ],
  neutral: [
    'Yeah, for sure. Anyway… how’s your day going?',
    'Mm, makes sense. So what brings you here today?',
    'Cool, cool. Yeah it’s been one of those weeks.',
    'Right. So, do you come to things like this often?',
  ],
  cool: [
    'Oh. Um, okay. Yeah.',
    'Right… anyway.',
    'Sure. I guess.',
    'Ha. Okay then. (looks around a little)',
  ],
}

function pick(arr, seed) { return arr[Math.abs(seed) % arr.length] }

// Deterministic-ish based on turn count for variety without randomness surprises.
export function mockReply(scenario, userText, turn) {
  const f = features(userText)
  let bucket = 'neutral'
  if (f.veryShort) bucket = 'cool'
  else if (f.openQuestion || (f.empathy && f.aboutThem)) bucket = 'warm'
  else if (f.asksQuestion || f.empathy) bucket = 'neutral'
  else if (f.words > 4) bucket = 'neutral'
  else bucket = 'cool'
  // Rejection scenario: persona stays gentle regardless, tests YOUR composure.
  if (scenario.id === 's-reject') {
    if (f.empathy || (!f.veryShort && !/please|come on|just|but/i.test(userText)))
      return 'Thank you for being so gracious about it — really. I’d still love to stay friends.'
    return 'I hope we can still be cool. I really do value you.'
  }
  return pick(REPLIES[bucket], userText.length + turn * 7)
}

// Wire a real model here later; return a Promise<string>.
export async function replaceMockReply(/* scenario, history */) {
  throw new Error('Live AI coach not connected. Configure a backend route and swap this in.')
}

// --- Performance scoring ---------------------------------------------------
const RUBRIC = ['Opening', 'Confidence', 'Listening', 'Question Quality',
  'Conversation Flow', 'Empathy', 'Clarity', 'Presence', 'Closing']

export function scoreSession(scenario, messages) {
  const userMsgs = messages.filter(m => m.role === 'user')
  const feats = userMsgs.map(m => features(m.text))
  const n = Math.max(1, feats.length)
  const questionRate = feats.filter(f => f.asksQuestion).length / n
  const openRate = feats.filter(f => f.openQuestion).length / n
  const empathyRate = feats.filter(f => f.empathy).length / n
  const avgWords = feats.reduce((a, f) => a + f.words, 0) / n
  const aboutThemRate = feats.filter(f => f.aboutThem).length / n
  const clamp = (v) => Math.max(20, Math.min(100, Math.round(v)))

  const scores = {
    'Opening':          clamp(feats[0] ? (feats[0].words >= 5 ? 78 : 55) + (feats[0].asksQuestion ? 12 : 0) : 40),
    'Confidence':       clamp(60 + (avgWords >= 8 ? 20 : 0) - (avgWords < 3 ? 25 : 0) + questionRate * 10),
    'Listening':        clamp(45 + aboutThemRate * 45 + empathyRate * 15),
    'Question Quality': clamp(40 + openRate * 55 + questionRate * 15),
    'Conversation Flow':clamp(45 + Math.min(n, 6) * 7 + (avgWords >= 6 ? 12 : 0)),
    'Empathy':          clamp(45 + empathyRate * 50),
    'Clarity':          clamp(avgWords >= 4 && avgWords <= 30 ? 80 : 58),
    'Presence':         clamp(50 + aboutThemRate * 25 + empathyRate * 20),
    'Closing':          clamp(n >= 3 ? 72 : 50),
  }
  const overall = Math.round(RUBRIC.reduce((a, k) => a + scores[k], 0) / RUBRIC.length)

  const strengths = []
  const improvements = []
  if (openRate > 0.3) strengths.push('You asked open-ended questions that invited real answers.')
  if (empathyRate > 0.25) strengths.push('You reflected feelings back — the other person felt heard.')
  if (aboutThemRate > 0.5) strengths.push('You kept the focus on them, which builds warmth fast.')
  if (avgWords >= 6 && avgWords <= 25) strengths.push('Your responses had substance without rambling.')
  if (!strengths.length) strengths.push('You showed up and stayed in the conversation — that’s the first rep.')

  if (openRate < 0.25) improvements.push('Trade a few statements for open questions (“what was that like?”).')
  if (empathyRate < 0.2) improvements.push('Acknowledge what they said before adding your own point.')
  if (avgWords < 3) improvements.push('Give a little more — one-word replies stall the momentum.')
  if (avgWords > 30) improvements.push('Tighten longer answers so the other person can jump back in.')
  if (aboutThemRate < 0.3) improvements.push('Point more curiosity at them; balance “I” with “you”.')
  if (!improvements.length) improvements.push('Push for a clear next step or graceful close to finish strong.')

  const better = betterExample(scenario)
  const recommend = recommendLesson(scenario)
  const xp = 40 + Math.round(overall / 2)

  return { overall, scores, rubric: RUBRIC, strengths, improvements, better, recommend, xp }
}

function betterExample(scenario) {
  const map = {
    's-coffee':    '“This place always has a line — clearly they’re doing something right. What do you usually get?”',
    's-network':   '“I’m Taylor — I work in ops. I actually loved the point you made earlier; I’d value your take on how you scaled that. Could I follow up over email this week?”',
    's-date':      '“I was a little nervous too — kind of nice to admit it. What’s something you’ve been genuinely excited about lately?”',
    's-interview': '“In my last role I owned X, which grew Y by Z. What drew me here is A — it’s the problem I most want to work on.”',
    's-coworker':  '“I’m not here to blame anyone. I want to figure out what went wrong so we can hit the next one. Can we walk through it together?”',
    's-raise':     '“Over the past year I’ve delivered X and taken on Y. Based on that impact and market rate, I’d like to discuss moving my comp to Z.”',
    's-friend':    '“We clearly keep the same schedule — a few of us grab coffee after sometimes. Want to join Thursday?”',
    's-reject':    '“Totally understand, and I appreciate you being straight with me. Friends sounds good — see you around.”',
  }
  return map[scenario.id] || '“Ask one genuine question, listen fully, then respond to what they actually said.”'
}

function recommendLesson(scenario) {
  const map = {
    's-coffee':    { academyId: 'a2', lessonN: 2, label: 'Opening Conversations Naturally' },
    's-network':   { academyId: 'a7', lessonN: 3, label: 'Giving Value First' },
    's-date':      { academyId: 'a8', lessonN: 7, label: 'First-Date Conversation' },
    's-interview': { academyId: 'a11', lessonN: 2, label: 'Clear Communication' },
    's-coworker':  { academyId: 'a9', lessonN: 4, label: 'Difficult Conversations' },
    's-raise':     { academyId: 'a11', lessonN: 3, label: 'Decision Communication' },
    's-friend':    { academyId: 'a6', lessonN: 4, label: 'Invitations' },
    's-reject':    { academyId: 'a8', lessonN: 6, label: 'Handling Rejection' },
  }
  return map[scenario.id] || { academyId: 'a2', lessonN: 4, label: 'Active Listening' }
}
