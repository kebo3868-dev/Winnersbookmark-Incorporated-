/**
 * Articles — the daily blog archive.
 *
 * In production, this becomes a CMS/database collection with one new entry
 * published every day. `heroImage` paths point to /public/images — drop the
 * final photography there using the same filenames.
 */

export interface ContentSection {
  heading: string;
  paragraphs: string[];
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  author: string;
  date: string; // ISO YYYY-MM-DD
  readingTime: string;
  excerpt: string;
  heroImage: string; // path under /public — replace with final photography
  contentSections: ContentSection[];
  pullQuote: string;
  actionSteps: string[];
  reflectionQuestions: string[];
  relatedArticles: string[]; // slugs
  premiumLocked: boolean;
}

export const articles: Article[] = [
  {
    id: "a1",
    slug: "discipline-beats-motivation",
    title: "Discipline Beats Motivation",
    subtitle: "Motivation is emotion. Discipline is architecture.",
    category: "Discipline",
    author: "Keith Warren",
    date: "2026-07-11",
    readingTime: "8 min read",
    excerpt:
      "Motivation shows up when it feels like it. Discipline shows up because you built it a schedule, a system, and a standard. Here is how to stop waiting on feelings and start engineering behavior.",
    heroImage: "/images/discipline-training.jpg",
    contentSections: [
      {
        heading: "The Problem With Waiting to Feel Ready",
        paragraphs: [
          "Every man knows the pattern. Sunday night you're on fire — new plan, new standards, new life. By Wednesday the feeling is gone, and with it the plan. That's not a character flaw. That's what happens when you build behavior on top of emotion. Emotion is weather. It changes hourly, and it never asks your permission.",
          "Motivation is a spark, and sparks are useful — but nobody heats a house with sparks. You heat a house with a furnace: a structure that produces warmth on schedule, regardless of the weather outside. Discipline is that furnace. It is behavior with architecture underneath it.",
        ],
      },
      {
        heading: "Discipline Is a Structure, Not a Mood",
        paragraphs: [
          "The disciplined man doesn't wake up wanting to train more than you do. He wakes up inside a structure where training is the default: clothes laid out, session programmed, time blocked, standard non-negotiable. Willpower is only needed when the system is missing.",
          "This is why the strongest men look the least heroic up close. There is no dramatic daily battle. There is a calendar, a checklist, and a refusal to renegotiate commitments at the exact moment they become uncomfortable. Decide once, at full strength — then let the structure carry you on weak days.",
        ],
      },
      {
        heading: "Build the Architecture",
        paragraphs: [
          "Start with one keystone behavior — training, reading, or deep work. Give it a fixed time, a fixed place, and a minimum standard so small you can hit it on your worst day. Ten minutes counts. The win is showing up; volume comes later.",
          "Then protect the identity, not just the habit. You are not 'trying to work out more.' You are a man who trains. Identity-level standards survive bad weeks. Task-level intentions don't.",
        ],
      },
    ],
    pullQuote:
      "Motivation asks how you feel. Discipline asks what you decided. Only one of those questions builds a life.",
    actionSteps: [
      "Choose one keystone habit and assign it a fixed time and place.",
      "Set a floor standard so small you can hit it on your worst day.",
      "Prepare the night before — remove every morning decision.",
      "Track the streak on paper where you can see it.",
    ],
    reflectionQuestions: [
      "Where in your life are you waiting to 'feel ready' instead of deciding?",
      "What is one commitment you renegotiate the moment it gets uncomfortable?",
      "What would your week look like if your standards didn't depend on your mood?",
    ],
    relatedArticles: [
      "atomic-habits-for-men-who-keep-starting-over",
      "deep-work-in-a-distracted-world",
      "fitness-is-a-leadership-system",
    ],
    premiumLocked: false,
  },
  {
    id: "a2",
    slug: "deep-work-in-a-distracted-world",
    title: "Deep Work in a Distracted World",
    subtitle: "Your attention is the last competitive advantage left.",
    category: "Focus",
    author: "Keith Warren",
    date: "2026-07-10",
    readingTime: "9 min read",
    excerpt:
      "Everyone has access to the same information, the same tools, the same AI. The only thing left to separate men is the depth of their attention. Here is how to reclaim it.",
    heroImage: "/images/reading-and-journaling.jpg",
    contentSections: [
      {
        heading: "The Economy Quietly Changed",
        paragraphs: [
          "Cal Newport saw it early: as shallow work gets automated and commoditized, the market pays a premium for men who can concentrate without distraction on cognitively demanding tasks. Deep work is not a productivity trick. It is the skill that makes every other skill compound.",
          "Meanwhile, the average man checks his phone over a hundred times a day. He is not losing to smarter competitors. He is losing to his own notifications.",
        ],
      },
      {
        heading: "Depth Is Trained, Not Found",
        paragraphs: [
          "You don't find focus; you build it like a muscle, with progressive overload. Start with one 60-minute block: one task, phone in another room, door closed. When 60 becomes easy, go to 90. Elite depth is two to four hours a day — that's it, and almost nobody does it.",
          "Rituals matter more than intensity. Same time, same desk, same start cue. The brain learns that this chair means depth, the way the gym means effort.",
        ],
      },
      {
        heading: "Protect the Asset",
        paragraphs: [
          "Every ding you answer retrains your brain toward shallowness. Attention residue from a ten-second glance can pollute the next twenty minutes of thought. Batch the shallow work — messages, admin, feeds — into scheduled windows, and let depth own the morning.",
          "The reward is asymmetric: one deeply focused morning routinely outproduces a scattered week. In a distracted world, the focused man operates like he has more hours than everyone else — because effectively, he does.",
        ],
      },
    ],
    pullQuote:
      "In a distracted world, the man who can focus for two hours operates like he has an unfair advantage — because he does.",
    actionSteps: [
      "Block one 90-minute deep work session tomorrow morning.",
      "Put the phone in a different room — not face down, gone.",
      "Batch messages and admin into two fixed windows per day.",
      "Track deep hours per week and treat the number like revenue.",
    ],
    reflectionQuestions: [
      "How many truly focused hours did you produce last week?",
      "What is the one project that would move your life if it got two deep hours a day?",
      "Which app costs you the most attention — and what is that costing you per year?",
    ],
    relatedArticles: [
      "discipline-beats-motivation",
      "the-spider-king-strategy-build-the-web-before-you-hunt",
      "money-is-stored-discipline",
    ],
    premiumLocked: false,
  },
  {
    id: "a3",
    slug: "money-is-stored-discipline",
    title: "Money Is Stored Discipline",
    subtitle: "Your bank account is a mirror of your habits, not your luck.",
    category: "Money",
    author: "Keith Warren",
    date: "2026-07-09",
    readingTime: "7 min read",
    excerpt:
      "Wealth is rarely a windfall. It is thousands of small, boring, disciplined decisions compounding quietly. Here is how to make your money a record of your standards.",
    heroImage: "/images/money-productivity.jpg",
    contentSections: [
      {
        heading: "The Mirror Test",
        paragraphs: [
          "Open your bank statement and read it like a journal, because that's what it is. Every line is a decision. Together they tell you exactly who you were last month — not who you claim to be, who you were. Money doesn't lie, flatter, or forget.",
          "This is uncomfortable, and it is also good news. If money is a mirror of habits, then money problems are habit problems — and habits can be rebuilt by any man willing to run the reps.",
        ],
      },
      {
        heading: "Automate the Standard",
        paragraphs: [
          "Pay yourself first, automatically. The day money lands, a fixed percentage moves to savings and investments before you can touch it. Discipline you automate is discipline you never have to summon.",
          "Then run the 24-hour rule on unplanned purchases and give every dollar a job before the month starts. A budget isn't a restriction; it's you, at full strength, making decisions your weaker moments must obey.",
        ],
      },
      {
        heading: "Earn Like a Builder",
        paragraphs: [
          "Cutting lattes has a floor; earning has no ceiling. The disciplined move is investing in skills that raise your market value — writing, selling, leadership, AI leverage — thirty minutes a day, compounding like interest.",
          "Stored discipline eventually buys the thing money is actually for: options. The ability to say no, to walk away, to take the risk, to protect your family. That's what you're really saving.",
        ],
      },
    ],
    pullQuote:
      "Every dollar you keep is a decision you made twice — once when you earned it, once when you refused to waste it.",
    actionSteps: [
      "Automate a fixed transfer to savings on payday — start at 10%.",
      "Apply the 24-hour rule to every unplanned purchase over $50.",
      "Give every dollar a job before the month begins.",
      "Invest 30 minutes a day in one income-raising skill.",
    ],
    reflectionQuestions: [
      "What does last month's bank statement say about your actual priorities?",
      "Which skill, if mastered, would raise your income the most in 12 months?",
      "What are you buying regularly that your future self would cancel?",
    ],
    relatedArticles: [
      "the-jim-rohn-rule-of-goal-setting",
      "discipline-beats-motivation",
      "atomic-habits-for-men-who-keep-starting-over",
    ],
    premiumLocked: true,
  },
  {
    id: "a4",
    slug: "fitness-is-a-leadership-system",
    title: "Fitness Is a Leadership System",
    subtitle: "Nobody follows a man who won't lead his own body.",
    category: "Fitness",
    author: "Keith Warren",
    date: "2026-07-08",
    readingTime: "8 min read",
    excerpt:
      "Training is not vanity. It is the daily proof that you keep promises to yourself — and the foundation of the energy, presence, and resilience leadership demands.",
    heroImage: "/images/fitness-healthy-aging.jpg",
    contentSections: [
      {
        heading: "The First Follower Is You",
        paragraphs: [
          "Leadership begins with self-command. Before anyone trusts you with a team, a family, or a mission, they read one signal instinctively: does this man govern himself? A trained body is visible evidence of invisible discipline.",
          "This has nothing to do with bodybuilding aesthetics. It has everything to do with a man who says 'I train Monday, Wednesday, Friday' and then does — for years. That reliability radiates into every other domain.",
        ],
      },
      {
        heading: "Energy Is a Leadership Resource",
        paragraphs: [
          "Decisions degrade when energy degrades. The leader who lifts, walks, sleeps, and eats clean shows up to hour ten with judgment intact while others are running on fumes and cortisol. Fitness is executive function insurance.",
          "Strength training twice or three times a week, a daily walk, real sleep — that modest system outperforms any extreme protocol you'll quit by March.",
        ],
      },
      {
        heading: "Train for the Decades",
        paragraphs: [
          "At 25 you train for the mirror. At 45 you train for energy and stress control. At 65 you train to carry your own luggage, lift your grandkids, and stay dangerous. The mission changes; the standard doesn't.",
          "Build the body that can carry the mission — whatever mission your life assigns you next.",
        ],
      },
    ],
    pullQuote:
      "Your body is the one team you can never delegate, trade, or resign from. Lead it first.",
    actionSteps: [
      "Commit to three strength sessions this week — schedule them now.",
      "Walk 8,000+ steps daily; treat it like a standing meeting.",
      "Set a sleep window and defend it like a deadline.",
      "Pick one lift and add small progressive overload for 12 weeks.",
    ],
    reflectionQuestions: [
      "What does your current physical condition signal to the people you lead?",
      "Where does your energy collapse each day, and what habit is causing it?",
      "What physical standard do you want to still hold at 70?",
    ],
    relatedArticles: [
      "clean-eating-is-mental-discipline",
      "discipline-beats-motivation",
      "atomic-habits-for-men-who-keep-starting-over",
    ],
    premiumLocked: false,
  },
  {
    id: "a5",
    slug: "clean-eating-is-mental-discipline",
    title: "Clean Eating Is Mental Discipline",
    subtitle: "Every meal is a vote for the man you're becoming.",
    category: "Nutrition",
    author: "Keith Warren",
    date: "2026-07-07",
    readingTime: "7 min read",
    excerpt:
      "Food is the most frequent discipline decision you make — twenty-plus times a week. Master it and you build a discipline engine that powers everything else.",
    heroImage: "/images/clean-nutrition.jpg",
    contentSections: [
      {
        heading: "The Most Repeated Rep",
        paragraphs: [
          "You make more food decisions than any other kind of decision. That makes nutrition the highest-volume discipline training available to you. Every clean meal is a rep. Every skipped impulse is a set.",
          "And the effects loop: clean fuel stabilizes energy and mood, stable energy strengthens willpower, stronger willpower makes the next clean choice easier. Junk food runs the same loop in reverse.",
        ],
      },
      {
        heading: "Decide Once — Meal Prep Is Strategy",
        paragraphs: [
          "The man who preps on Sunday makes one strong decision instead of twenty weak ones. By Thursday night, when willpower is gone, dinner is already decided. That's not cooking; that's strategic pre-commitment.",
          "Keep it simple and repeatable: protein at every meal, whole foods you can name, water before anything else, and an eating window that ends before the late-night spiral begins.",
        ],
      },
      {
        heading: "Standards, Not Diets",
        paragraphs: [
          "Diets are temporary emergencies. Standards are permanent identity. 'I eat like a man who trains' survives birthdays, travel, and bad weeks in a way that 'I'm doing a 30-day challenge' never will.",
          "Aim for 80/20 excellence over 100/0 perfection. Perfection quits in week three. Standards compound for decades.",
        ],
      },
    ],
    pullQuote:
      "You don't rise to your cravings — you fall to your grocery list. Write it like it matters.",
    actionSteps: [
      "Prep three protein-forward meals this Sunday.",
      "Drink a glass of water before every meal and coffee.",
      "Remove one trigger food from the house entirely.",
      "Set a nightly kitchen-closed time and honor it.",
    ],
    reflectionQuestions: [
      "Which eating decision do you lose most often, and at what time of day?",
      "What would your energy feel like after 30 days of clean fuel?",
      "What food standard would the strongest version of you hold?",
    ],
    relatedArticles: [
      "fitness-is-a-leadership-system",
      "discipline-beats-motivation",
      "atomic-habits-for-men-who-keep-starting-over",
    ],
    premiumLocked: true,
  },
  {
    id: "a6",
    slug: "the-48-laws-of-power-for-modern-men",
    title: "The 48 Laws of Power for Modern Men",
    subtitle: "Understand the game — so you never have to play it dirty.",
    category: "Books",
    author: "Keith Warren",
    date: "2026-07-06",
    readingTime: "10 min read",
    excerpt:
      "Robert Greene's classic is not a manual for manipulation. Read correctly, it is armor: pattern recognition for the power dynamics running through every office, deal, and room you enter.",
    heroImage: "/images/monthly-book-stack.jpg",
    contentSections: [
      {
        heading: "Read It as Armor, Not Ammunition",
        paragraphs: [
          "The 48 Laws makes some men cynical and other men perceptive. The difference is intent. The perceptive reader studies the laws the way a bodyguard studies attacks — to recognize them early, not to use them on family and friends.",
          "Power dynamics exist whether you acknowledge them or not. The naive man isn't morally superior; he's just unarmed.",
        ],
      },
      {
        heading: "The Laws That Matter Most at Work",
        paragraphs: [
          "'Never outshine the master' is about reading ego before displaying talent. 'Always say less than necessary' builds gravity in meetings where nervous men leak credibility with every extra sentence. 'Guard your reputation with your life' — in the digital age, your reputation is a permanent, searchable asset.",
          "And 'Think as you like but behave like others' is not conformity; it's choosing which battles deserve your visible resistance and which don't.",
        ],
      },
      {
        heading: "Power With Honor",
        paragraphs: [
          "The modern move is to combine Greene's pattern recognition with a hard personal code: build real competence, keep your word, and let strategy protect your mission rather than replace it.",
          "The goal is to be impossible to blindside and unnecessary to fear — a man who sees every move on the board and still plays clean.",
        ],
      },
    ],
    pullQuote:
      "The naive man isn't more virtuous than the strategic man. He's just easier to remove from the board.",
    actionSteps: [
      "Identify the actual decision-maker in your most important room.",
      "Practice saying 30% less in your next three meetings.",
      "Audit your digital reputation — search yourself and clean it up.",
      "Write your personal code: three lines you will not cross for advantage.",
    ],
    reflectionQuestions: [
      "Where have you been played recently because you didn't see the game?",
      "Which law do you violate most often — and what does it cost you?",
      "What is your line between strategy and manipulation?",
    ],
    relatedArticles: [
      "the-spider-king-strategy-build-the-web-before-you-hunt",
      "deep-work-in-a-distracted-world",
      "les-brown-and-the-power-of-voice",
    ],
    premiumLocked: true,
  },
  {
    id: "a7",
    slug: "atomic-habits-for-men-who-keep-starting-over",
    title: "Atomic Habits for Men Who Keep Starting Over",
    subtitle: "You don't need a new plan. You need a smaller one you can't lose.",
    category: "Discipline",
    author: "Keith Warren",
    date: "2026-07-05",
    readingTime: "8 min read",
    excerpt:
      "If you've restarted the same transformation five times, the problem isn't your willpower — it's your architecture. James Clear's system, rebuilt for the chronic restarter.",
    heroImage: "/images/daily-knowledge.jpg",
    contentSections: [
      {
        heading: "Why You Keep Starting Over",
        paragraphs: [
          "The restart cycle has a signature: a huge, inspiring plan; a perfect week one; a missed day in week two; then the verdict — 'I blew it' — and total collapse until the next surge of motivation. The plan was built for your best week, so it shattered on your first normal one.",
          "James Clear's answer is scale. Make the habit so small that failure requires effort. Two pushups. One page. One sentence in the journal. You're not training the muscle yet — you're training the identity of a man who shows up.",
        ],
      },
      {
        heading: "The Four Laws, Weaponized",
        paragraphs: [
          "Make it obvious: put the book on the pillow, the shoes by the door. Make it attractive: pair the habit with something you enjoy. Make it easy: two-minute versions of everything. Make it satisfying: a paper streak you can see.",
          "Then add the rule that saves chronic restarters: never miss twice. Missing once is life. Missing twice is the start of a new identity — the old one.",
        ],
      },
      {
        heading: "Identity Before Outcomes",
        paragraphs: [
          "Stop chasing outcomes ('lose 30 pounds') and start casting votes for an identity ('I am a man who trains'). Outcomes lag for months; identity votes are counted daily. Every rep, every page, every clean meal is a vote — and elections are won by vote count, not speeches.",
          "One percent better daily is invisible for weeks and undeniable within a year. The math has never failed a man who stayed in the game.",
        ],
      },
    ],
    pullQuote:
      "You don't blow it by missing once. You blow it by treating one miss as a verdict instead of a data point.",
    actionSteps: [
      "Shrink your restarted habit to a two-minute version.",
      "Apply 'never miss twice' as a hard rule.",
      "Stack the new habit onto one that already survives your worst weeks.",
      "Track votes for identity, not just outcomes.",
    ],
    reflectionQuestions: [
      "Which habit have you restarted most — and what killed it each time?",
      "What is the two-minute version of the change you actually want?",
      "Who are you voting to become with your current daily behavior?",
    ],
    relatedArticles: [
      "discipline-beats-motivation",
      "clean-eating-is-mental-discipline",
      "the-jim-rohn-rule-of-goal-setting",
    ],
    premiumLocked: false,
  },
  {
    id: "a8",
    slug: "the-jim-rohn-rule-of-goal-setting",
    title: "The Jim Rohn Rule of Goal Setting",
    subtitle: "Set goals for what they make of you, not just what they get you.",
    category: "Goal Setting",
    author: "Keith Warren",
    date: "2026-07-04",
    readingTime: "7 min read",
    excerpt:
      "Jim Rohn's deepest teaching wasn't about achieving goals — it was about who you must become to reach them. That shift changes how a serious man writes his list.",
    heroImage: "/images/reading-and-journaling.jpg",
    contentSections: [
      {
        heading: "The Question Behind the Goal",
        paragraphs: [
          "Rohn's famous line reframes everything: the major value of reaching a goal is not what you get — it's what it makes of you to achieve it. The million dollars matters less than the discipline, judgment, and skill of the man who can earn it.",
          "This is why inherited outcomes rarely stick. Give a man the destination without the journey and he keeps neither. Become the man first, and the outcomes become repeatable.",
        ],
      },
      {
        heading: "Write the List Like Rohn",
        paragraphs: [
          "Set goals in every domain — economic, physical, mental, spiritual, family — because a fortune with a failing body is a bad trade. Write them down; unwritten goals are wishes. Then mark each one 1, 3, 5, or 10 years out so today's actions inherit a timeline.",
          "Then Rohn's edge: next to each goal, write who you must become to hit it. The reader. The early riser. The man who makes the calls. That column is the real plan.",
        ],
      },
      {
        heading: "The Daily Discipline Bridge",
        paragraphs: [
          "Goals without daily disciplines are entertainment. Rohn's bridge: a few simple disciplines, practiced every day. Read the pages. Do the work. Make the calls. Review the plan. Nothing dramatic — just the errors of judgment replaced, one by one, with disciplines of habit.",
          "Success, he said, is nothing more than a few disciplines practiced daily; failure is a few errors in judgment repeated daily. Both compound quietly. You choose which one is compounding right now.",
        ],
      },
    ],
    pullQuote:
      "Set the kind of goals that make something of you to achieve them — then keep the man and let the goals multiply.",
    actionSteps: [
      "Write ten goals across money, body, mind, and family — on paper.",
      "Tag each goal 1, 3, 5, or 10 years.",
      "For your top three, write who you must become to reach them.",
      "Choose two daily disciplines that build that man, starting today.",
    ],
    reflectionQuestions: [
      "Who would you have to become to hit your biggest goal?",
      "Which daily error of judgment is quietly compounding against you?",
      "If you achieved everything on your list, what kind of man would the process have built?",
    ],
    relatedArticles: [
      "money-is-stored-discipline",
      "les-brown-and-the-power-of-voice",
      "atomic-habits-for-men-who-keep-starting-over",
    ],
    premiumLocked: true,
  },
  {
    id: "a9",
    slug: "les-brown-and-the-power-of-voice",
    title: "Les Brown and the Power of Voice",
    subtitle: "It's not over until you win — and it starts with what you say to yourself.",
    category: "Confidence",
    author: "Keith Warren",
    date: "2026-07-03",
    readingTime: "7 min read",
    excerpt:
      "Les Brown went from being labeled 'educable mentally retarded' to commanding the world's biggest stages. His weapon was voice — the outer one and, first, the inner one.",
    heroImage: "/images/monthly-mentor-board.jpg",
    contentSections: [
      {
        heading: "Someone Else's Opinion of You",
        paragraphs: [
          "As a boy, Les Brown was labeled and dismissed. One teacher's sentence rerouted his life: 'Someone's opinion of you does not have to become your reality.' Every man carries labels — from fathers, bosses, exes, teachers. Brown's first lesson is that labels are input, not identity.",
          "The voice that ultimately runs your life isn't the critic's. It's the one narrating inside your head at 6am when the alarm goes off. Train that voice like you'd train a muscle.",
        ],
      },
      {
        heading: "Speak Life Out Loud",
        paragraphs: [
          "Brown is famous for making audiences say things out loud — 'It's possible!' — because spoken words carry different weight than thoughts. Declaring a standard out loud, to yourself or another man, creates an accountability the silent wish never faces.",
          "Your outer voice matters too. The man who can stand up and speak clearly — in a meeting, at a funeral, to his son — carries influence that no résumé line can match. Communication is a discipline. Practice it on purpose.",
        ],
      },
      {
        heading: "Hungry Beats Smart",
        paragraphs: [
          "'You gotta be hungry' wasn't a catchphrase; it was Brown's entire competitive analysis. Talent is common. Credentials are common. Hunger — the willingness to do the boring reps after the applause stops — is rare, and it's available to any man who decides.",
          "And his gravest warning: the graveyard is the richest place on earth, full of unwritten books, unstarted businesses, unspoken words. Don't die with your best still inside you.",
        ],
      },
    ],
    pullQuote:
      "Someone's opinion of you does not have to become your reality — unless you keep repeating it in their voice.",
    actionSteps: [
      "Write down the label you've carried longest — then write the evidence against it.",
      "Declare one goal out loud to a man who will hold you to it.",
      "Practice speaking: record yourself for two minutes on a topic you care about.",
      "Do one 'hungry' rep today that talent alone would skip.",
    ],
    reflectionQuestions: [
      "Whose opinion of you have you been living as fact?",
      "What would you attempt this year if you were genuinely hungry?",
      "What is still inside you that you refuse to take to the graveyard?",
    ],
    relatedArticles: [
      "the-jim-rohn-rule-of-goal-setting",
      "discipline-beats-motivation",
      "the-48-laws-of-power-for-modern-men",
    ],
    premiumLocked: true,
  },
  {
    id: "a10",
    slug: "the-spider-king-strategy-build-the-web-before-you-hunt",
    title: "The Spider King Strategy: Build the Web Before You Hunt",
    subtitle: "Stop chasing opportunity. Build the structure it walks into.",
    category: "Legacy Building",
    author: "Keith Warren",
    date: "2026-07-02",
    readingTime: "9 min read",
    excerpt:
      "The Spider King does not chase randomly. He builds systems, structure, content, habits, and strategy before the opportunity arrives. The web is the system — and the opportunity walks into what was already built.",
    heroImage: "/images/spider-king-strategy.jpg",
    contentSections: [
      {
        heading: "Two Kinds of Hunters",
        paragraphs: [
          "The wolf chases. Every meal costs a sprint, and every sprint costs energy he must immediately replace. The spider builds. He invests upfront in structure — the web — and then opportunity comes to him, caught by architecture instead of pursuit.",
          "Most men live like wolves: chasing clients, chasing jobs, chasing motivation, chasing every opportunity individually, from zero, forever. The Spider King plays a different game. He asks one question before he hunts: what structure, built once, would catch this repeatedly?",
        ],
      },
      {
        heading: "The Web Is the System",
        paragraphs: [
          "Your web is everything that works while you sleep: the skills you've stacked, the content you've published, the reputation you've compounded, the habits that hold under pressure, the network that mentions your name in rooms you're not in, the savings that let you say no.",
          "Every strand is boring on the day you build it. One blog post. One rep. One saved dollar. One genuine relationship. But strands cross, and crossing strands become a net — and one day a big opportunity lands on it and doesn't slip through, because you built for that day years earlier.",
        ],
      },
      {
        heading: "Build Before You Need It",
        paragraphs: [
          "The amateur builds the web after he sees the fly — the résumé after the layoff, the network when he needs a favor, the discipline when the doctor delivers bad news. By then the opportunity is gone or the price has tripled.",
          "The Spider King builds in peacetime. He publishes before he's known, trains before the crisis, saves before the downturn, and learns before the industry shifts. Preparation looks like paranoia right up until it looks like genius.",
        ],
      },
      {
        heading: "Patience Is a Weapon",
        paragraphs: [
          "A spider doesn't panic when the web sits empty for a day. He doesn't tear it down and start chasing. He maintains the structure, repairs the broken strands, and trusts the design. Panic is what happens to men without webs.",
          "Build your web daily — this platform exists to hand you the strands. Then hold position with the patience of a king who knows exactly what his structure will catch.",
        ],
      },
    ],
    pullQuote:
      "The wolf eats what he can chase. The Spider King eats what his structure catches — and the structure never gets tired.",
    actionSteps: [
      "List your current web: skills, content, reputation, network, reserves.",
      "Identify the weakest strand and schedule one building block this week.",
      "Publish or create one asset that works without you present.",
      "Stop one chase this week and redirect that energy into structure.",
    ],
    reflectionQuestions: [
      "Are you living like the wolf or the spider right now?",
      "What opportunity have you missed because the structure wasn't built yet?",
      "What web, built over the next five years, would make chasing unnecessary?",
    ],
    relatedArticles: [
      "the-48-laws-of-power-for-modern-men",
      "deep-work-in-a-distracted-world",
      "money-is-stored-discipline",
    ],
    premiumLocked: true,
  },
];

export const featuredArticle = articles[0];

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getArticlesByCategory(category: string): Article[] {
  return articles.filter(
    (a) => a.category.toLowerCase() === category.toLowerCase()
  );
}
