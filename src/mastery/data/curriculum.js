// Winnersbookmark Social Mastery — Master Curriculum
// 12 academies. Each lesson is fully playable: authored content where provided,
// otherwise a coherent templated lesson generated from the lesson metadata.

// The eleven tracked skills used across scoring and analytics.
export const SKILLS = [
  { key: 'confidence',           label: 'Confidence' },
  { key: 'conversation',         label: 'Conversation' },
  { key: 'presence',             label: 'Presence' },
  { key: 'listening',            label: 'Listening' },
  { key: 'storytelling',         label: 'Storytelling' },
  { key: 'networking',           label: 'Networking' },
  { key: 'dating',               label: 'Dating Comms' },
  { key: 'relationships',        label: 'Relationships' },
  { key: 'publicSpeaking',       label: 'Public Speaking' },
  { key: 'leadership',           label: 'Leadership' },
  { key: 'emotionalIntelligence',label: 'Emotional IQ' },
]

export const SKILL_LABEL = Object.fromEntries(SKILLS.map(s => [s.key, s.label]))

const L = (title, teaches, minutes = 7) => ({ title, teaches, minutes })

export const ACADEMIES = [
  {
    id: 'a1', n: 1, title: 'Inner Confidence', accent: 'gold',
    subtitle: 'Steadiness that does not depend on the room.',
    icon: 'Flame', skills: ['confidence', 'presence'],
    blurb: 'Build a calm, self-respecting baseline so social situations stop feeling like auditions.',
    lessons: [
      L('Confidence Without Performing', 'Grounding your worth in behavior, not applause'),
      L('Stop Seeking Approval', 'Detaching your mood from other people’s reactions'),
      L('Handling Social Fear', 'Working with fear signals instead of fighting them'),
      L('Rejection Resilience', 'Making a “no” cost you almost nothing'),
      L('Calm Under Pressure', 'Regulating your body before your words'),
      L('Self-Respect and Boundaries', 'Saying no without a speech'),
      L('Confidence Through Action', 'Building proof through small brave reps'),
    ],
  },
  {
    id: 'a2', n: 2, title: 'Conversation Fundamentals', accent: 'amber',
    subtitle: 'The mechanics of a conversation that flows.',
    icon: 'MessagesSquare', skills: ['conversation', 'listening'],
    blurb: 'From a cold open to a graceful exit — the repeatable structure behind easy talk.',
    lessons: [
      L('Starting From Zero', 'Why openers matter less than warmth'),
      L('Opening Conversations Naturally', 'Situational, sincere, low-pressure openers'),
      L('Asking Better Questions', 'Open loops over yes/no dead-ends'),
      L('Active Listening', 'Listening to understand, not to reply'),
      L('Avoiding Interview Mode', 'Trading statements, not just questions'),
      L('Keeping Conversations Flowing', 'Threading, callbacks, and shared discovery'),
      L('Ending Conversations Gracefully', 'Leaving warm and leaving the door open'),
    ],
  },
  {
    id: 'a3', n: 3, title: 'Charisma & Presence', accent: 'gold',
    subtitle: 'Making people feel something when they’re with you.',
    icon: 'Sparkles', skills: ['presence', 'confidence'],
    blurb: 'Charisma is warmth plus presence — trainable, not magic.',
    lessons: [
      L('What Charisma Actually Is', 'Warmth, presence, and power decoded'),
      L('Presence Over Performance', 'Being here instead of managing an image'),
      L('Warmth and Confidence', 'The two-dial model of charisma'),
      L('Eye Contact', 'Comfortable, connected, non-creepy gaze'),
      L('Vocal Presence', 'Pace, pitch, and pauses that land'),
      L('Energy Matching', 'Meeting people where they are first'),
      L('Making People Feel Seen', 'The rarest and most magnetic skill'),
    ],
  },
  {
    id: 'a4', n: 4, title: 'Body Language', accent: 'amber',
    subtitle: 'The 93% you’re broadcasting before you speak.',
    icon: 'PersonStanding', skills: ['presence', 'listening'],
    blurb: 'Read the room and send signals that match your intent.',
    lessons: [
      L('Posture', 'Open, tall, and relaxed under attention'),
      L('Eye Contact', 'Signaling attention without staring'),
      L('Facial Expression', 'A face that matches your message'),
      L('Gestures', 'Hands that clarify instead of leaking nerves'),
      L('Personal Space', 'Reading and respecting distance'),
      L('Reading Social Signals', 'Interest, discomfort, and exits'),
      L('Congruent Body Language', 'When words and body agree'),
    ],
  },
  {
    id: 'a5', n: 5, title: 'Storytelling', accent: 'gold',
    subtitle: 'Becoming the person people quote later.',
    icon: 'BookOpen', skills: ['storytelling', 'conversation'],
    blurb: 'Turn ordinary moments into stories people lean in for.',
    lessons: [
      L('Why Stories Work', 'How narrative hijacks attention and memory'),
      L('Story Structure', 'Setup, tension, turn, and payoff'),
      L('Creating Curiosity', 'Opening loops the listener needs closed'),
      L('Emotional Hooks', 'Stakes that make people care'),
      L('Humor', 'Timing, self-deprecation, and the callback'),
      L('Story Compression', 'Cutting to the version that lands'),
      L('Becoming Memorable', 'Signature stories and themes'),
    ],
  },
  {
    id: 'a6', n: 6, title: 'Making Friends', accent: 'amber',
    subtitle: 'Turning strangers into people who text back.',
    icon: 'Users', skills: ['emotionalIntelligence', 'conversation'],
    blurb: 'The overlooked mechanics of adult friendship: repetition, initiation, follow-up.',
    lessons: [
      L('Meeting New People', 'Putting yourself in range on purpose'),
      L('Turning Acquaintances Into Friends', 'The escalation ladder of closeness'),
      L('Following Up', 'The move most people skip'),
      L('Invitations', 'Low-pressure asks that get a yes'),
      L('Building Social Circles', 'Introducing and hosting'),
      L('Becoming a Connector', 'Giving before you need anything'),
      L('Maintaining Friendships', 'Keeping bonds alive with little effort'),
    ],
  },
  {
    id: 'a7', n: 7, title: 'Networking', accent: 'gold',
    subtitle: 'Relationships that compound professionally.',
    icon: 'Handshake', skills: ['networking', 'conversation'],
    blurb: 'Give-first networking that never feels slimy.',
    lessons: [
      L('Entering a Room', 'The first 90 seconds, solved'),
      L('Starting Professional Conversations', 'Openers beyond “what do you do”'),
      L('Giving Value First', 'Being useful before being useful to yourself'),
      L('Remembering Names', 'Simple encoding that actually sticks'),
      L('Introducing People', 'The highest-leverage social move'),
      L('Following Up', 'Turning a card into a relationship'),
      L('Building Strategic Relationships', 'Depth over a giant contact list'),
    ],
  },
  {
    id: 'a8', n: 8, title: 'Dating Communication', accent: 'amber',
    subtitle: 'Confident, respectful, and honest connection.',
    icon: 'Heart', skills: ['dating', 'confidence'],
    blurb: 'Ethical attraction built on confidence, consent, and curiosity — never manipulation.',
    lessons: [
      L('Confidence Before Attraction', 'Being settled before being interesting'),
      L('Starting Conversations Respectfully', 'Warm, direct, pressure-free openers'),
      L('Reading Mutual Interest', 'Green lights, yellow lights, and respect'),
      L('Flirting Naturally', 'Playful, honest, and calibrated'),
      L('Asking Someone Out', 'A clear, low-stakes invitation'),
      L('Handling Rejection', 'Staying gracious and unshaken'),
      L('First-Date Conversation', 'Connection over interviewing'),
      L('Authentic Attraction', 'Being chosen for who you actually are'),
    ],
  },
  {
    id: 'a9', n: 9, title: 'Relationships', accent: 'gold',
    subtitle: 'The communication that keeps love healthy.',
    icon: 'HeartHandshake', skills: ['relationships', 'emotionalIntelligence'],
    blurb: 'Express needs, hold boundaries, and repair conflict without damage.',
    lessons: [
      L('Emotional Communication', 'Naming feelings without blame'),
      L('Expressing Needs', 'Requests instead of resentment'),
      L('Boundaries', 'Kind, clear, and consistent limits'),
      L('Difficult Conversations', 'Raising hard things safely'),
      L('Conflict Resolution', 'Repair over winning'),
      L('Active Listening', 'Making a partner feel heard'),
      L('Trust', 'The small deposits that build it'),
      L('Healthy Attachment and Independence', 'Close and still whole'),
    ],
  },
  {
    id: 'a10', n: 10, title: 'Public Speaking', accent: 'amber',
    subtitle: 'Command a room without pretending to be someone else.',
    icon: 'Mic', skills: ['publicSpeaking', 'presence'],
    blurb: 'From shaky nerves to a message that moves a room.',
    lessons: [
      L('Speaking With Confidence', 'Owning the room you’re standing in'),
      L('Controlling Nervousness', 'Channeling adrenaline into energy'),
      L('Vocal Delivery', 'Volume, pace, and the power of the pause'),
      L('Storytelling on Stage', 'Structure that keeps attention'),
      L('Audience Engagement', 'Talking with, not at, a room'),
      L('Persuasion', 'Ethos, pathos, and logos in practice'),
      L('Impromptu Speaking', 'Frameworks for thinking on your feet'),
      L('Presentation Mastery', 'Slides that support, not compete'),
    ],
  },
  {
    id: 'a11', n: 11, title: 'Leadership Presence', accent: 'gold',
    subtitle: 'Influence people choose to follow.',
    icon: 'Crown', skills: ['leadership', 'presence'],
    blurb: 'Executive presence and clear communication that build trust and results.',
    lessons: [
      L('Executive Presence', 'Calm, clear, and credible under scrutiny'),
      L('Clear Communication', 'Saying the important thing first'),
      L('Decision Communication', 'Committing and explaining the why'),
      L('Giving Feedback', 'Direct and caring at the same time'),
      L('Handling Conflict', 'Leading through disagreement'),
      L('Leading Meetings', 'Time, focus, and a real outcome'),
      L('Influence Without Manipulation', 'Trust as your operating system'),
    ],
  },
  {
    id: 'a12', n: 12, title: 'Advanced Social Intelligence', accent: 'amber',
    subtitle: 'Reading and shaping any social system.',
    icon: 'BrainCircuit', skills: ['emotionalIntelligence', 'listening'],
    blurb: 'The high-level calibration that ties every other academy together.',
    lessons: [
      L('Reading the Room', 'Status, mood, and unspoken rules'),
      L('Group Dynamics', 'Adding energy to a group, not draining it'),
      L('Emotional Intelligence', 'Self-awareness to social awareness'),
      L('Social Calibration', 'Adjusting in real time to feedback'),
      L('Difficult Personalities', 'Staying centered with hard people'),
      L('Negotiation', 'Value creation over pressure'),
      L('Persuasion Ethics', 'Influence with a clean conscience'),
      L('Advanced Presence', 'Effortless, integrated, unmistakably you'),
    ],
  },
]

// ---- Stable ids & lookups -------------------------------------------------
ACADEMIES.forEach((a) => {
  a.lessons.forEach((les, i) => {
    les.id = `${a.id}-l${i + 1}`
    les.academyId = a.id
    les.index = i
    les.n = i + 1
  })
})

export const ACADEMY_BY_ID = Object.fromEntries(ACADEMIES.map(a => [a.id, a]))
export const ALL_LESSONS = ACADEMIES.flatMap(a => a.lessons)
export const LESSON_BY_ID = Object.fromEntries(ALL_LESSONS.map(l => [l.id, l]))
export const TOTAL_LESSONS = ALL_LESSONS.length

// ---- Lesson content engine ------------------------------------------------
// A handful of fully authored lessons; everything else is generated coherently
// from the lesson's title + academy theme so every node is playable.

const AUTHORED = {
  'a1-l1': {
    hook: 'You walk into a room where you know no one. Your chest tightens, you reach for your phone, and a voice says: “everyone can tell you don’t belong here.” What if that voice is measuring the wrong thing?',
    idea: 'Real confidence isn’t a performance you turn on for an audience — it’s the quiet decision to stay in the room and act like yourself even while uncomfortable. You build it through behavior, not applause.',
    example: 'Maya used to rehearse a “cooler” version of herself before parties. It exhausted her and never worked. She switched to one rule: “I’m allowed to be a little awkward and stay anyway.” Within weeks people described her as more relaxed — because she was.',
    bad: 'Performing a persona: scanning faces for approval, laughing a beat too hard, agreeing with everything so no one can reject the real you.',
    better: 'Grounding in behavior: slow your exhale, plant your feet, and offer one genuine reaction. You’re not trying to be liked — you’re being present.',
    quiz: {
      q: 'Which behavior best reflects grounded confidence?',
      options: [
        { text: 'Rehearsing a wittier version of yourself beforehand', correct: false },
        { text: 'Staying in the room and reacting honestly even while nervous', correct: true },
        { text: 'Agreeing with everything so nobody can reject you', correct: false },
        { text: 'Checking your phone until someone approaches you', correct: false },
      ],
      explain: 'Confidence is a behavior you choose under discomfort — not a mood that arrives first or an image you project.',
    },
    challenge: 'Today, enter one situation as yourself with no performance upgrade. Say one honest reaction out loud (“Oh, I love this song”). Notice you survived.',
    reflect: 'Where did you notice the urge to perform — and what happened when you stayed yourself instead?',
  },
  'a2-l3': {
    hook: '“So… what do you do? Cool. And where are you from? Nice.” Three questions in, the conversation is already dying. The problem usually isn’t the topic — it’s the shape of the questions.',
    idea: 'Great questions open loops instead of closing them. Swap yes/no and fact-collection for questions about experience, opinion, and story: “what was that like,” “what got you into it,” “what’s the part people don’t expect.”',
    example: 'Instead of “Do you like your job?” try “What’s the part of your job you’d happily do for free?” The second one gives the other person somewhere interesting to go — and gives you a thread to pull.',
    bad: 'Rapid-fire fact questions: job, hometown, age. It feels like a form, and the other person starts giving one-word answers.',
    better: 'Experience and opinion questions, then a follow-up on the most alive word they said. Curiosity beats a checklist.',
    quiz: {
      q: 'Which is the strongest open question?',
      options: [
        { text: 'Do you like living here?', correct: false },
        { text: 'What’s something about this city that surprised you?', correct: true },
        { text: 'How long have you lived here?', correct: false },
        { text: 'Is the traffic bad here?', correct: false },
      ],
      explain: 'Open questions invite a story or an opinion and hand the other person a thread you can both follow.',
    },
    challenge: 'In your next conversation, ask one “what was that like?” question and then follow up on the most interesting word in their answer.',
    reflect: 'Which question opened the conversation up — and how did their energy change when it did?',
  },
  'a8-l6': {
    hook: 'You asked, and they said no. Your face is hot and your brain is already writing the story where you’re unlovable. Rejection is inevitable in dating — but the spiral afterward is optional.',
    idea: 'A healthy response to rejection protects both people: you stay gracious, you don’t argue or negotiate, and you keep your self-worth off the table. A “no” is information about fit, not a verdict on your value.',
    example: 'Sam asked a coworker to coffee; she declined. He simply said, “No worries at all — good working with you either day.” Nothing got weird, and his week wasn’t ruined. That composure is itself attractive and, more importantly, kind.',
    bad: 'Pushing back (“come on, just one drink”), going cold, or spiraling into “I always get rejected.” This pressures them and punishes you.',
    better: 'Warm acknowledgement, zero pressure, and a clean exit. Then you redirect the story: “that was a brave, respectful ask, and I’m fine.”',
    quiz: {
      q: 'What’s the healthiest response to a “no”?',
      options: [
        { text: 'Ask again in case they change their mind', correct: false },
        { text: 'Accept it warmly and keep your dignity intact', correct: true },
        { text: 'Go cold to show it didn’t affect you', correct: false },
        { text: 'Decide you’re bad at dating and stop trying', correct: false },
      ],
      explain: 'Respecting a no — without pressure or self-punishment — protects the other person and keeps your confidence intact.',
    },
    challenge: 'Do one small thing today where “no” is a real possibility (an ask, an invite, a request). Practice receiving the answer — either answer — with grace.',
    reflect: 'What story did your mind try to tell after the ask? Was it actually true?',
  },
}

const THEME = {
  a1: { verb: 'stay grounded', feeling: 'that flicker of self-doubt' },
  a2: { verb: 'keep it flowing', feeling: 'the awkward silence' },
  a3: { verb: 'bring presence', feeling: 'the urge to impress' },
  a4: { verb: 'read the signals', feeling: 'a mismatch between words and body' },
  a5: { verb: 'tell it well', feeling: 'a story falling flat' },
  a6: { verb: 'make the connection', feeling: 'not knowing how to go deeper' },
  a7: { verb: 'add value first', feeling: 'the transactional cringe' },
  a8: { verb: 'connect honestly', feeling: 'the fear of coming on wrong' },
  a9: { verb: 'communicate cleanly', feeling: 'the tension before a hard talk' },
  a10:{ verb: 'own the room', feeling: 'the spotlight nerves' },
  a11:{ verb: 'lead clearly', feeling: 'the pressure to have every answer' },
  a12:{ verb: 'calibrate in real time', feeling: 'a room you can’t quite read' },
}

export function getLessonContent(lessonId) {
  if (AUTHORED[lessonId]) return AUTHORED[lessonId]
  const lesson = LESSON_BY_ID[lessonId]
  if (!lesson) return null
  const a = ACADEMY_BY_ID[lesson.academyId]
  const t = THEME[a.id]
  const title = lesson.title
  const teaches = lesson.teaches.toLowerCase()
  return {
    hook: `Think of the last time ${t.feeling} showed up and “${title}” would have changed the moment. That gap is exactly what this lesson closes.`,
    idea: `${title} is really about ${teaches}. In ${a.title.toLowerCase()}, the skill is not a trick — it’s a repeatable habit you can practice until it feels like you.`,
    example: `Picture a real situation from your week where you needed to ${t.verb}. Someone who has trained “${title}” handles it with a small, deliberate move most people never learned to make.`,
    bad: `The common miss: defaulting to autopilot, forcing it, or over-thinking — which broadcasts exactly ${t.feeling} you were trying to hide.`,
    better: `The upgrade: apply ${teaches} with one intentional, low-pressure action. Small and genuine beats big and performed every time.`,
    quiz: {
      q: `What’s the core of “${title}”?`,
      options: [
        { text: `A memorized line you deploy to impress people`, correct: false },
        { text: `A repeatable habit built on ${teaches}`, correct: true },
        { text: `Waiting until you feel completely ready`, correct: false },
        { text: `Copying someone else’s personality`, correct: false },
      ],
      explain: `${title} works because it’s a trainable behavior rooted in ${teaches} — not a performance or a personality transplant.`,
    },
    challenge: `Today, find one real moment to ${t.verb} using what “${title}” taught you. Keep it small enough that you’ll actually do it.`,
    reflect: `Where could you have used “${title}” recently — and what will you try differently next time?`,
  }
}
