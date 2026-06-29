// Article library for Winners Bookmark Daily Blogs.
//
// Each post has metadata + a `body` array of content blocks. The blocks render
// through <ArticleBody />. Supported block types:
//   { type: 'p', text }                      paragraph
//   { type: 'h2' | 'h3', text }              section heading
//   { type: 'quote', text, cite }            pull quote
//   { type: 'list', items: [] }              bullet list
//   { type: 'image', caption }               visual / infographic placeholder
//   { type: 'takeaways', items: [] }         "Key Takeaways" box
//   { type: 'actions', items: [] }           "Action Steps" box
//   { type: 'callout', title, text }         highlighted insight box
//   { type: 'lesson', book, text }           "Lesson From the Book" box
//   { type: 'meaning', text }                "What This Means for Men Today"
//   { type: 'divider' }                      section divider
//
// `tier: 'free'` posts are fully readable; `tier: 'member'` posts show a
// paywall teaser after the preview (handled in the post page).

export const posts = [
  {
    slug: 'discipline-is-freedom-in-practice',
    title: 'Discipline Is Freedom in Practice',
    subtitle:
      'Why the most controlled men are also the most free — and how to build the discipline that runs your life when motivation is gone.',
    category: 'discipline',
    tags: ['Discipline', 'Self-Mastery', 'Habits'],
    author: 'The Winners Bookmark Editorial Team',
    date: '2026-06-29',
    readTime: 9,
    tier: 'free',
    featured: true,
    excerpt:
      'Motivation is a guest that never stays. Discipline is the structure you build so the work happens whether the guest shows up or not. This is the blueprint.',
    takeaways: [
      'Discipline is not punishment — it is the architecture of freedom',
      'Standards beat moods: decide once, then execute on autopilot',
      'Small daily reps compound into an identity you can trust',
    ],
    body: [
      { type: 'p', text: 'There is a lie sold to men everywhere: that freedom means doing whatever you feel like, whenever you feel like it. It sounds good. It is also the fastest road to a small, chaotic life. The men who are genuinely free — free from anxiety, free from debt, free from the tyranny of their own impulses — are almost always the most disciplined men you will ever meet.' },
      { type: 'p', text: 'Discipline is not the opposite of freedom. It is the price of it. The man who trains his body is free to use it. The man who controls his spending is free to make bold moves. The man who governs his attention is free to do work that matters. Every form of freedom worth having sits on the other side of a discipline.' },
      { type: 'quote', text: 'We must all suffer one of two things: the pain of discipline or the pain of regret. Discipline weighs ounces; regret weighs tons.', cite: 'Jim Rohn' },
      { type: 'h2', text: 'Motivation Is a Guest. Discipline Is the House.' },
      { type: 'p', text: 'Motivation is real, but it is a guest — it visits, it inspires, and then it leaves, usually right when the work gets hard. If your entire system depends on feeling motivated, your system depends on a guest who has no obligation to show up. Discipline is different. Discipline is the house itself: the structure that stands whether or not anyone is feeling inspired today.' },
      { type: 'p', text: 'The strongest men design their lives so that the right action requires the least decision. They do not wake up and ask whether they feel like training, working, or eating clean. They decided that months ago. The decision is already made; all that remains is execution. This is the quiet secret of disciplined men — they have removed the daily negotiation.' },
      { type: 'image', caption: 'Infographic: "The Discipline Loop" — Decide Once → Build the System → Execute Daily → Reinforce Identity → Repeat.' },
      { type: 'callout', title: 'The Core Principle', text: 'Discipline is what you do when motivation is absent. Build your life so the default behavior is the disciplined one, and you win on your worst days — not just your best.' },
      { type: 'h2', text: 'Standards Over Moods' },
      { type: 'p', text: 'A man governed by moods is governed by the weather inside his own head — and that weather changes constantly. A man governed by standards has a fixed point. The standard says: I train five days a week. The standard says: I do not check my phone before I do my most important work. The standard does not care that it is raining, that you slept poorly, or that you are not "feeling it." The standard simply is.' },
      { type: 'p', text: 'When you raise a standard and hold it through resistance, something deeper happens. You begin to trust yourself. And self-trust is the foundation of every confident decision a man makes. The man who keeps his promises to himself walks differently than the man who breaks them.' },
      { type: 'list', items: [
        'Define one non-negotiable standard in your health, your work, and your money.',
        'Write each as a clear rule, not a vague intention ("I lift 4x/week" beats "I’ll exercise more").',
        'Hold the standard for 30 days before you judge it — identity forms in the reps.',
      ] },
      { type: 'lesson', book: 'Atomic Habits — James Clear', text: 'Every action you take is a vote for the type of person you wish to become. Discipline is not about a single heroic act; it is about casting the same vote, quietly, day after day, until the identity is undeniable.' },
      { type: 'h2', text: 'How to Build Discipline That Lasts' },
      { type: 'p', text: 'Discipline is trainable, but most men attack it the wrong way — with a burst of willpower that flames out in two weeks. Real discipline is built like muscle: progressive, consistent, and protected by good systems. You do not need more willpower. You need better architecture around the willpower you already have.' },
      { type: 'p', text: 'Start absurdly small. Make the first rep so easy you cannot say no, then let momentum do the heavy lifting. Stack your new discipline onto an existing habit so it has an anchor. Remove the friction from the right action and add friction to the wrong one. And track it — what gets measured gets respected.' },
      { type: 'actions', items: [
        'Pick ONE discipline to install this week. One. Not five.',
        'Shrink it until it is almost embarrassingly easy to start.',
        'Anchor it to something you already do daily (after coffee, before shower).',
        'Track it visibly — a calendar, an X for every day you execute.',
        'Never miss twice. One miss is a slip; two is the start of a new pattern.',
      ] },
      { type: 'meaning', text: 'In a world engineered to keep you distracted, comfortable, and consuming, discipline is rebellion. It is how an ordinary man takes back authorship of his life. You will not always feel powerful — but if you build the disciplines, you will become powerful, and the feeling will follow the fact.' },
      { type: 'h2', text: 'The Bottom Line' },
      { type: 'p', text: 'Discipline is not a cage. It is the scaffolding you build around a life worth living. Choose the pain of discipline now, in ounces, or pay the pain of regret later, in tons. The choice is daily, and it is yours.' },
    ],
    related: ['deep-work-blueprint-for-focus', 'fitness-as-masculine-discipline', 'men-need-standards-not-excuses'],
  },

  {
    slug: 'deep-work-blueprint-for-focus',
    title: 'Deep Work: A Modern Blueprint for Focus',
    subtitle:
      'What Cal Newport’s landmark book teaches men about reclaiming attention in an economy designed to steal it.',
    category: 'focus',
    tags: ['Focus', 'Book Breakdowns', 'Productivity'],
    author: 'The Winners Bookmark Editorial Team',
    date: '2026-06-28',
    readTime: 12,
    tier: 'free',
    featured: false,
    excerpt:
      'The ability to focus without distraction is becoming rare — which is exactly why it is becoming valuable. Here is the applied blueprint from Deep Work.',
    takeaways: [
      'Deep work is rare, valuable, and trainable — the focus economy rewards it',
      'Shallow work feels productive but rarely moves your life forward',
      'Schedule depth deliberately; do not leave it to whatever is left of the day',
    ],
    body: [
      { type: 'p', text: 'Cal Newport opens Deep Work with a quiet, dangerous observation: the ability to concentrate without distraction is becoming increasingly rare at exactly the same time it is becoming increasingly valuable. That gap — between how scarce focus is and how much it is worth — is the greatest career and personal opportunity available to a man who is willing to train it.' },
      { type: 'quote', text: 'The deep work hypothesis: the ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable. As a consequence, the few who cultivate this skill, and then make it the core of their working life, will thrive.', cite: 'Cal Newport' },
      { type: 'h2', text: 'Deep Work vs. Shallow Work' },
      { type: 'p', text: 'Newport draws a hard line between two kinds of effort. Deep work is cognitively demanding activity performed in a state of distraction-free concentration that pushes your abilities to their limit and creates real value. Shallow work is the logistical, low-value, often-interrupted noise — email, notifications, meetings about meetings — that fills a day and leaves nothing behind.' },
      { type: 'p', text: 'Most men spend their best hours on shallow work and wonder why their lives are not moving. They are busy, but busyness is not productivity. The needle-moving work — the book, the business, the skill, the body — only responds to depth.' },
      { type: 'image', caption: 'Infographic: A bar chart contrasting "Hours Felt Busy" vs. "Hours of Real Output" for a typical knowledge worker.' },
      { type: 'lesson', book: 'Deep Work — Cal Newport', text: 'Clarity about what matters provides clarity about what does not. Decide what deep work deserves your best hours, then ruthlessly protect those hours from everything shallow.' },
      { type: 'h2', text: 'The Four Disciplines of Depth' },
      { type: 'p', text: 'Newport does not just diagnose the problem — he hands you a system. The practical core comes down to a handful of disciplines you can install this week.' },
      { type: 'list', items: [
        'Work deeply — schedule depth in advance and ritualize it, rather than waiting for inspiration.',
        'Embrace boredom — train your brain to tolerate the absence of stimulation so it can sustain focus.',
        'Quit shallow inputs — be ruthless about the social media and apps that fracture your attention.',
        'Drain the shallows — cap shallow work and protect a hard daily ceiling on it.',
      ] },
      { type: 'callout', title: 'The Focus Multiplier', text: 'High-Quality Work = Time Spent × Intensity of Focus. You can double your output without adding a single hour — simply by removing the distraction tax on the hours you already have.' },
      { type: 'h2', text: 'How Men Apply This' },
      { type: 'p', text: 'Theory is worthless without execution. Here is how to turn Deep Work from a book you read into a discipline you live. Start with one ninety-minute block of true depth per day, defended like a meeting with the most important client of your life — because it is.' },
      { type: 'actions', items: [
        'Block one 90-minute "deep work" session on tomorrow’s calendar. Title it. Defend it.',
        'Put your phone in another room during the block — not face-down, another room.',
        'Define the single output for the block before you start ("draft the proposal").',
        'Batch shallow work (email, messages) into one or two windows — not all day.',
        'End each day by scheduling tomorrow’s deep block. Never improvise it.',
      ] },
      { type: 'meaning', text: 'A man’s attention is the most valuable thing he owns, and it is under coordinated attack by an industry that profits from his distraction. To reclaim your focus is to reclaim your agency. The man who controls his attention controls the trajectory of his life.' },
      { type: 'h2', text: 'The Bottom Line' },
      { type: 'p', text: 'Focus is no longer a soft skill — it is the hard edge that separates the men who build from the men who merely scroll. Train it like the rare asset it is, and you will out-produce people far more talented than you.' },
    ],
    related: ['discipline-is-freedom-in-practice', 'atomic-habits-and-identity', 'men-need-standards-not-excuses'],
  },

  {
    slug: 'fitness-as-masculine-discipline',
    title: 'Fitness as a Form of Masculine Discipline',
    subtitle:
      'The gym is not about vanity. It is the most honest classroom a man will ever enter — and the lessons transfer to everything.',
    category: 'fitness',
    tags: ['Fitness', 'Discipline', 'Self-Mastery'],
    author: 'The Winners Bookmark Editorial Team',
    date: '2026-06-27',
    readTime: 8,
    tier: 'free',
    featured: false,
    excerpt:
      'The iron never lies. It will not flatter you and it cannot be negotiated with. That is exactly why every man should train.',
    takeaways: [
      'Training builds the body, but it forges the mind that carries the body',
      'The gym is a daily, honest rep of doing hard things on purpose',
      'Physical discipline becomes the keystone habit that lifts everything else',
    ],
    body: [
      { type: 'p', text: 'There is a reason that strong, focused men so often share one habit: they train. Not for the mirror — though the mirror responds — but because the gym is the most honest classroom a man will ever enter. The weight does not care about your excuses. It does not care that you are tired, busy, or important. It responds only to effort, consistency, and time. The iron never lies.' },
      { type: 'quote', text: 'The mind is the most powerful weapon you have. Train it the same way you train your body — through resistance, repetition, and refusing to quit.', cite: 'Tim Grover, Relentless' },
      { type: 'h2', text: 'Why the Gym Transfers to Everything' },
      { type: 'p', text: 'When you walk into a gym and choose to do something hard on purpose, you are running a rep of a skill that has nothing to do with muscles: the skill of voluntary difficulty. You are teaching your nervous system that discomfort is survivable, that effort produces change, and that you are the kind of man who follows through. That lesson does not stay in the gym. It walks out with you into your work, your money, and your relationships.' },
      { type: 'callout', title: 'Keystone Habit', text: 'Training is a keystone habit — one discipline that pulls others up behind it. Men who start lifting often find they sleep better, eat cleaner, drink less, and work harder. The body sets the tone for the man.' },
      { type: 'image', caption: 'Photo treatment: a man under a loaded barbell at the bottom of a squat — tension, focus, control. Cinematic, high-contrast.' },
      { type: 'h2', text: 'You Don’t Need a Perfect Program — You Need to Show Up' },
      { type: 'p', text: 'Men overcomplicate training. They spend more time researching the optimal program than executing any program. The truth is that almost any sensible plan, run consistently for a year, will transform you. Consistency beats optimization every single time.' },
      { type: 'list', items: [
        'Train 3–5 days a week, prioritizing compound lifts (squat, hinge, press, pull).',
        'Progress the load or the reps over time — the body adapts to demand.',
        'Sleep 7–8 hours; recovery is where the adaptation actually happens.',
        'Eat enough protein to support the work (roughly 0.7–1g per pound of bodyweight).',
      ] },
      { type: 'actions', items: [
        'Schedule your first three training sessions for this week — specific days, specific times.',
        'Pick a simple beginner program and commit to it for 12 weeks without switching.',
        'Lay out your gym clothes the night before to remove morning friction.',
        'Track your lifts so you can see progress — progress is the fuel that sustains discipline.',
      ] },
      { type: 'meaning', text: 'A man who trains learns, in his body, that he can change his circumstances through effort over time. That belief — earned under a barbell — is the same belief that builds businesses, breaks addictions, and rebuilds lives. Strength is a metaphor you can hold in your hands.' },
      { type: 'h2', text: 'The Bottom Line' },
      { type: 'p', text: 'Train because it makes you harder to break. Train because the discipline transfers. Train because the man who controls his body has taken the first and most honest step toward controlling his life.' },
    ],
    related: ['discipline-is-freedom-in-practice', 'nutrition-fuel-for-the-mission', 'men-need-standards-not-excuses'],
  },

  {
    slug: '48-laws-of-power-for-real-men',
    title: '10 Lessons From The 48 Laws of Power for Real-World Men',
    subtitle:
      'Robert Greene’s most controversial book is not a manual for manipulation. It is a field guide to seeing the game clearly.',
    category: 'book-breakdowns',
    tags: ['Book Breakdowns', 'Strategy', 'Leadership'],
    author: 'The Winners Bookmark Editorial Team',
    date: '2026-06-26',
    readTime: 14,
    tier: 'member',
    featured: true,
    excerpt:
      'You do not have to play power games to be destroyed by them. Greene’s laws teach you to see the board — so you are never an unwitting pawn on it.',
    takeaways: [
      'Power is a game being played around you whether you participate or not',
      'Emotional control is the foundation of every strategic advantage',
      'Reputation and self-command are assets you build deliberately',
    ],
    body: [
      { type: 'p', text: 'Few books provoke men like The 48 Laws of Power. Read shallowly, it sounds like a manual for ruthlessness. Read seriously, it is something far more useful: a clear-eyed map of how power, influence, and human nature actually operate — drawn from three thousand years of history. You do not have to manipulate anyone to benefit from Greene’s work. You simply have to stop being naive.' },
      { type: 'quote', text: 'The future belongs to those who learn more skills and combine them in creative ways.', cite: 'Robert Greene' },
      { type: 'h2', text: 'Law: Master Your Emotions' },
      { type: 'p', text: 'Greene returns again and again to a single foundation: the man who cannot control his emotions cannot control his strategy. Anger makes you predictable. Impatience makes you exploitable. The strategic man feels everything but is ruled by nothing. He responds; he does not react.' },
      { type: 'callout', title: 'The Real Lesson', text: 'Power begins as self-command. Before you can influence a room, a deal, or a team, you must first govern the one person you can actually control — yourself.' },
      { type: 'h2', text: 'Law: Guard Your Reputation With Your Life' },
      { type: 'p', text: 'Your reputation is the lens through which every person decides whether to trust you, hire you, follow you, or back you. It is built slowly and broken instantly. Greene treats it as a man’s most valuable possession — and tells you to defend it accordingly.' },
      { type: 'lesson', book: 'The 48 Laws of Power — Robert Greene', text: 'So much depends on reputation — guard it with your life. A solid reputation increases your presence and exposes the weaknesses of those who attack you.' },
      { type: 'h3', text: 'Why This Matters for the Modern Man' },
      { type: 'p', text: 'In an age of permanent records and instant broadcast, reputation compounds faster than ever — in both directions. The man who is known for keeping his word, doing excellent work, and staying composed builds an asset that opens doors for decades.' },
      { type: 'image', caption: 'Quote card: "Power is the ability to remain calm while everyone around you loses their head." Gold serif type on charcoal.' },
      { type: 'actions', items: [
        'Audit your reactions for one week — note every time emotion drove a decision.',
        'Choose one trait you want to be known for, then act in alignment with it daily.',
        'Before reacting to provocation, impose a 24-hour pause on anything irreversible.',
        'Study one historical figure Greene cites and extract a single applicable tactic.',
      ] },
      { type: 'meaning', text: 'Greene is not asking you to become cold or cruel. He is asking you to grow up — to stop pretending the game is not being played and start playing it with integrity and open eyes. The honest man who understands power is far harder to exploit than the honest man who refuses to look.' },
      { type: 'h2', text: 'The Bottom Line' },
      { type: 'p', text: 'Read The 48 Laws not to manipulate, but to see. The clearer your sight, the harder you are to move — and the more deliberately you can build the life and influence you actually want.' },
    ],
    related: ['discipline-is-freedom-in-practice', 'deep-work-blueprint-for-focus', 'money-and-self-control'],
  },

  {
    slug: 'atomic-habits-and-identity',
    title: 'Atomic Habits and Identity Transformation',
    subtitle:
      'You do not rise to the level of your goals. You fall to the level of your systems — and your systems are built on identity.',
    category: 'habits',
    tags: ['Habits', 'Book Breakdowns', 'Self-Mastery'],
    author: 'The Winners Bookmark Editorial Team',
    date: '2026-06-25',
    readTime: 11,
    tier: 'member',
    featured: false,
    excerpt:
      'The deepest lever in James Clear’s system is not the habit itself — it is the identity the habit votes for. Change who you believe you are, and behavior follows.',
    takeaways: [
      'Goals set direction; systems produce results',
      'Every action is a vote for the type of man you are becoming',
      'Identity-based habits outlast outcome-based motivation',
    ],
    body: [
      { type: 'p', text: 'James Clear’s Atomic Habits became a phenomenon for a reason: it took the science of behavior change and made it usable. But beneath the famous tactics — habit stacking, the two-minute rule, environment design — sits one idea that does most of the heavy lifting, and most readers underuse it. That idea is identity.' },
      { type: 'quote', text: 'Every action you take is a vote for the type of person you wish to become. No single instance will transform your beliefs, but as the votes build up, so does the evidence of your new identity.', cite: 'James Clear' },
      { type: 'h2', text: 'Systems Beat Goals' },
      { type: 'p', text: 'Goals are useful for setting direction, but they are a poor engine for daily behavior. Everyone at the starting line of a race shares the same goal; what separates them is their systems. Clear’s reframe is liberating: stop obsessing over the outcome and start engineering the process that makes the outcome inevitable.' },
      { type: 'callout', title: 'The Shift', text: 'Outcome-based habit: "I want to get fit." Identity-based habit: "I am a man who trains." The first relies on willpower. The second relies on self-image — and self-image is far more durable.' },
      { type: 'h2', text: 'The Four Laws of Behavior Change' },
      { type: 'p', text: 'Clear distills habit-building into four practical laws. To build a good habit, run all four; to break a bad one, invert them.' },
      { type: 'list', items: [
        'Make it obvious — design your environment so the right cue is unavoidable.',
        'Make it attractive — pair the habit with something you already enjoy.',
        'Make it easy — shrink it to a two-minute version you cannot refuse.',
        'Make it satisfying — give yourself immediate evidence of progress.',
      ] },
      { type: 'image', caption: 'Infographic: "The Four Laws" as a 2x2 grid, each quadrant with a one-line tactic. Electric-blue accents.' },
      { type: 'lesson', book: 'Atomic Habits — James Clear', text: 'You do not rise to the level of your goals. You fall to the level of your systems. Build the system, embody the identity, and results stop requiring heroic motivation.' },
      { type: 'actions', items: [
        'Name the identity you want ("I am a focused, disciplined man") and write it down.',
        'Choose one tiny habit that proves that identity, and shrink it to two minutes.',
        'Stack it onto an existing routine so the cue is automatic.',
        'Track the streak — let the visible evidence reinforce the new self-image.',
      ] },
      { type: 'meaning', text: 'Most men try to change their lives by changing their goals and forcing their willpower. The deeper move is to change who you believe you are. Decide the kind of man you intend to be, then cast one small vote for him every day. Identity is the most powerful, least-used lever in personal development.' },
      { type: 'h2', text: 'The Bottom Line' },
      { type: 'p', text: 'Forget the dramatic overhaul. Get one percent better, vote for the right identity, and let compounding do what willpower never could.' },
    ],
    related: ['discipline-is-freedom-in-practice', 'deep-work-blueprint-for-focus', 'men-need-standards-not-excuses'],
  },

  {
    slug: 'money-and-self-control',
    title: 'The Real Relationship Between Money and Self-Control',
    subtitle:
      'Most money problems are not math problems. They are discipline problems wearing a financial costume.',
    category: 'money',
    tags: ['Money', 'Discipline', 'Self-Mastery'],
    author: 'The Winners Bookmark Editorial Team',
    date: '2026-06-24',
    readTime: 10,
    tier: 'member',
    featured: false,
    excerpt:
      'Money is stored discipline. The same self-control that builds your body builds your bank account — and the same impulsivity drains both.',
    takeaways: [
      'Wealth is built by behavior far more than by income',
      'Every dollar saved is a unit of stored self-control',
      'Financial freedom is the compound interest of small disciplined choices',
    ],
    body: [
      { type: 'p', text: 'Here is a truth the financial industry would rather you not internalize: most money problems are not math problems. They are discipline problems. The math of building wealth is simple enough to fit on an index card — spend less than you earn, invest the difference consistently, repeat for decades. The reason most men never do it has nothing to do with the math and everything to do with self-control.' },
      { type: 'quote', text: 'Money is stored discipline. Every dollar you keep is a small refusal to trade your future for a present impulse.', cite: 'Winners Bookmark' },
      { type: 'h2', text: 'Income Is Not the Problem' },
      { type: 'p', text: 'Plenty of high earners are broke, and plenty of modest earners are quietly wealthy. The difference is rarely the size of the paycheck — it is the gap between what comes in and what goes out, sustained over time. A man who cannot control his spending will be broke at any income. A man who can will build wealth on almost any income.' },
      { type: 'callout', title: 'The Core Equation', text: 'Wealth = (Income − Lifestyle) × Time × Consistency. Most men try to fix the first variable while ignoring the three that actually compound.' },
      { type: 'h2', text: 'The Same Muscle, A Different Gym' },
      { type: 'p', text: 'The self-control that lets you finish a hard workout is the same self-control that lets you skip an impulse purchase. The patience that builds a body over years is the patience that lets compound interest do its quiet, miraculous work. Money is simply another arena where masculine discipline either serves you or exposes you.' },
      { type: 'image', caption: 'Infographic: a compound-interest curve showing how small consistent investments outpace sporadic large ones over 30 years.' },
      { type: 'list', items: [
        'Automate the disciplined choice — pay yourself first the moment income lands.',
        'Create friction for impulse spending; create ease for saving and investing.',
        'Define "enough" so lifestyle does not silently inflate with every raise.',
        'Think in decades — wealth is the compound interest of consistent behavior.',
      ] },
      { type: 'actions', items: [
        'Set up an automatic transfer to savings/investments on every payday this month.',
        'Track every dollar for 30 days — awareness alone changes behavior.',
        'Impose a 48-hour rule on any non-essential purchase over a set threshold.',
        'Increase your savings rate by one percent — then again next quarter.',
      ] },
      { type: 'meaning', text: 'Financial control is not about deprivation; it is about power. The man who controls his money controls his time, his options, and his ability to take bold risks. Building wealth is one of the most concrete, measurable forms of self-mastery available to a man — and the scoreboard never lies.' },
      { type: 'h2', text: 'The Bottom Line' },
      { type: 'p', text: 'Treat money as stored discipline. Win the small daily battles between impulse and intention, automate the wins so they stop requiring willpower, and let time turn ordinary behavior into extraordinary freedom.' },
    ],
    related: ['discipline-is-freedom-in-practice', 'atomic-habits-and-identity', '48-laws-of-power-for-real-men'],
  },

  {
    slug: 'men-need-standards-not-excuses',
    title: 'Why Men Need Standards, Not Excuses',
    subtitle:
      'An excuse is a story you tell to make peace with falling short. A standard is a line you refuse to fall below.',
    category: 'self-mastery',
    tags: ['Self-Mastery', 'Discipline', 'Purpose'],
    author: 'The Winners Bookmark Editorial Team',
    date: '2026-06-23',
    readTime: 7,
    tier: 'free',
    featured: false,
    excerpt:
      'The gap between the man you are and the man you could be is usually filled with reasonable-sounding excuses. Replace them with standards and watch the gap close.',
    takeaways: [
      'Excuses are comfortable lies; standards are uncomfortable truths',
      'A standard you hold under pressure becomes part of your identity',
      'Raise the floor of your behavior and the ceiling takes care of itself',
    ],
    body: [
      { type: 'p', text: 'Every man carries two lists. One is the list of standards he holds — the lines he will not cross, the things he does regardless of mood. The other is the list of excuses he keeps on hand for the days he wants to fall short. The quality of a man’s life is largely decided by which list is longer.' },
      { type: 'quote', text: 'Don’t wish it were easier. Wish you were better. Don’t wish for fewer problems. Wish for more skills.', cite: 'Jim Rohn' },
      { type: 'h2', text: 'The Anatomy of an Excuse' },
      { type: 'p', text: 'An excuse is a story — usually a reasonable-sounding one — that you tell yourself to make peace with falling short. "I was tired." "It’s been a hard week." "I’ll start Monday." None of these are lies, exactly. That is what makes them dangerous. The most effective excuses are partly true, which is why they slip past your defenses so easily.' },
      { type: 'callout', title: 'The Hard Question', text: 'Ask yourself: is this a reason, or is it a permission slip? A reason explains a result. A permission slip authorizes you to quit. Learn to tell the difference and you defeat half your excuses on sight.' },
      { type: 'h2', text: 'Standards Raise the Floor' },
      { type: 'p', text: 'Excuses lower the floor of your behavior — they let you sink on your worst days. Standards do the opposite: they set a floor below which you refuse to fall, no matter how you feel. And here is the secret most men miss: you do not rise on your best days. You rise by raising the floor. Win the bad days and the good days take care of themselves.' },
      { type: 'image', caption: 'Quote card: "Discipline is choosing between what you want now and what you want most." Bold sans type, crimson accent.' },
      { type: 'actions', items: [
        'List your three most common excuses — name them out loud, in writing.',
        'For each excuse, define the standard it violates ("tired" vs. "I train regardless").',
        'Pick one standard to hold for 30 days no matter what your mood reports.',
        'When the excuse arrives, recognize it as a permission slip and refuse to sign.',
      ] },
      { type: 'meaning', text: 'No one is coming to hold you to a higher standard — that job is yours alone. The modern world will happily supply you with endless reasons to settle. A serious man builds his own standards and holds the line when no one is watching. That private integrity is the root of public strength.' },
      { type: 'h2', text: 'The Bottom Line' },
      { type: 'p', text: 'Trade your excuses for standards, one at a time. Raise the floor of your behavior and you will be amazed how high the ceiling rises on its own.' },
    ],
    related: ['discipline-is-freedom-in-practice', 'fitness-as-masculine-discipline', 'money-and-self-control'],
  },

  {
    slug: 'nutrition-fuel-for-the-mission',
    title: 'Nutrition: Fuel for the Mission',
    subtitle:
      'You would not put garbage in a machine you depend on. Your body is that machine — and your mind runs on what you feed it.',
    category: 'nutrition',
    tags: ['Nutrition', 'Fitness', 'Discipline'],
    author: 'The Winners Bookmark Editorial Team',
    date: '2026-06-22',
    readTime: 8,
    tier: 'free',
    featured: false,
    excerpt:
      'Clean eating without the dogma. A practical nutrition framework for men who need energy, clarity, and the discipline to sustain a mission.',
    takeaways: [
      'Energy and mental clarity are downstream of what you eat',
      'You do not need a perfect diet — you need a repeatable one',
      'Discipline at the table is discipline everywhere else',
    ],
    body: [
      { type: 'p', text: 'A man on a mission needs fuel for that mission, and most men are running on the nutritional equivalent of cheap, dirty gas — then wondering why their energy crashes, their focus fades, and their discipline buckles by mid-afternoon. Nutrition is not vanity. It is the input that determines the quality of nearly every output your body and brain produce.' },
      { type: 'quote', text: 'Discipline at the dinner table is the same discipline that builds your body, your focus, and your fortune. It does not get a day off.', cite: 'Winners Bookmark' },
      { type: 'h2', text: 'Eat for Energy and Clarity' },
      { type: 'p', text: 'Forget the extremes and the fads. The goal is simple: eat in a way that gives you steady energy, sharp focus, and the raw materials to build a strong body. That means prioritizing protein, eating mostly whole foods, and not spiking and crashing on sugar all day. You can feel the difference within a week.' },
      { type: 'callout', title: 'The Simple Standard', text: 'Build most meals from a protein, a vegetable, and a smart carb. Drink water. Limit the liquid calories and the ultra-processed snacks. That alone puts you ahead of the vast majority of men.' },
      { type: 'list', items: [
        'Anchor every meal with a quality protein source — it drives satiety and muscle.',
        'Fill half the plate with vegetables for micronutrients and fullness.',
        'Choose whole-food carbs around training; go lighter when sedentary.',
        'Hydrate consistently — mild dehydration quietly tanks focus and mood.',
      ] },
      { type: 'image', caption: 'Photo treatment: a clean, high-protein plate — grilled meat, greens, rice — shot from above with cinematic lighting.' },
      { type: 'actions', items: [
        'Plan and prep two or three default meals you can repeat without thinking.',
        'Hit a protein target at each meal (a palm-sized portion is a simple gauge).',
        'Remove one regular source of junk from your home this week.',
        'Carry water; aim to start the day hydrated before caffeine.',
      ] },
      { type: 'meaning', text: 'How a man eats is a daily referendum on whether he runs his appetites or his appetites run him. Mastering your nutrition is not about obsession or aesthetics — it is about refusing to let a base impulse sabotage the mission you claim to care about. Discipline at the table is discipline everywhere.' },
      { type: 'h2', text: 'The Bottom Line' },
      { type: 'p', text: 'Fuel the machine like you depend on it — because you do. Eat for energy, clarity, and strength, keep it simple enough to repeat, and let clean fuel power a relentless mission.' },
    ],
    related: ['fitness-as-masculine-discipline', 'discipline-is-freedom-in-practice', 'men-need-standards-not-excuses'],
  },

  {
    slug: 'rebuild-your-life-with-structure',
    title: 'How to Rebuild Your Life With Structure',
    subtitle:
      'When everything feels broken, you do not need a breakthrough. You need a frame. Structure is how men climb out.',
    category: 'purpose',
    tags: ['Purpose', 'Discipline', 'Self-Mastery'],
    author: 'The Winners Bookmark Editorial Team',
    date: '2026-06-21',
    readTime: 9,
    tier: 'member',
    featured: false,
    excerpt:
      'Rock bottom is not the end of the story. For many men it is the foundation — and structure is the first brick you lay on it.',
    takeaways: [
      'Chaos is defeated by structure, not by waiting to feel better',
      'A simple daily frame restores a sense of agency fast',
      'You rebuild a life the same way you build anything — one rep at a time',
    ],
    body: [
      { type: 'p', text: 'Every man hits a season where the structures that held his life together come apart — a job lost, a relationship ended, a habit gone too far, a direction that disappeared. In those seasons, men wait for motivation or clarity to return, as if the right feeling will arrive and fix things. It almost never does. What rebuilds a man is not a feeling. It is a frame.' },
      { type: 'quote', text: 'You will never always be motivated. You have to learn to be disciplined. Structure is discipline you can see.', cite: 'Winners Bookmark' },
      { type: 'h2', text: 'Why Structure Comes Before Motivation' },
      { type: 'p', text: 'When life feels chaotic, the chaos itself drains your will. Every undefined hour is a small decision to make, and decision fatigue compounds into paralysis. Structure removes those decisions. A simple, repeatable daily frame gives your mind something solid to stand on — and from solid ground, a man can start to climb.' },
      { type: 'callout', title: 'The First Move', text: 'Do not try to fix your whole life at once. Fix tomorrow morning. Win the first three hours of one day, then repeat. A life is rebuilt in mornings.' },
      { type: 'h2', text: 'A Minimum Viable Structure' },
      { type: 'p', text: 'You do not need an elaborate system. You need a floor — a handful of non-negotiables that anchor each day regardless of how you feel. Keep it almost embarrassingly simple at first; you can build on a foundation, but you cannot build on nothing.' },
      { type: 'list', items: [
        'A fixed wake time — the keystone that sets the tone for everything after it.',
        'Movement every day, even a walk — the body leads the mind out of the hole.',
        'One meaningful task completed before noon — proof you can still move the world.',
        'A fixed wind-down and sleep time — recovery is part of the rebuild, not a reward.',
      ] },
      { type: 'image', caption: 'Infographic: "The Minimum Viable Day" — a simple time-blocked schedule from wake to wind-down.' },
      { type: 'actions', items: [
        'Choose a single wake time and hold it every day for two weeks.',
        'Define three non-negotiables for tomorrow and write them where you’ll see them.',
        'Complete one of them before checking your phone or the news.',
        'At night, review and reset the three for the next day — keep the chain alive.',
      ] },
      { type: 'meaning', text: 'A man rebuilding his life often believes he has lost everything. What he has actually lost is structure — and structure can be rebuilt deliberately, brick by brick, starting tomorrow morning. The same discipline that builds a body or a business will quietly build a man back from the bottom.' },
      { type: 'h2', text: 'The Bottom Line' },
      { type: 'p', text: 'Stop waiting to feel ready. Build the frame, hold it through the resistance, and let structure carry you until momentum returns. That is how men climb out — not in a leap, but in a thousand ordinary, disciplined steps.' },
    ],
    related: ['discipline-is-freedom-in-practice', 'men-need-standards-not-excuses', 'atomic-habits-and-identity'],
  },
];

export const postBySlug = (slug) => posts.find((p) => p.slug === slug);

export const postsByCategory = (slug) => posts.filter((p) => p.category === slug);

export const featuredPosts = () => posts.filter((p) => p.featured);

// Newest post by date — drives the "Featured Today" homepage slot.
export const latestPost = () =>
  [...posts].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

export const sortedPosts = () =>
  [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
