const DAILY_ADVICE = [
  {
    title: "The 2-Minute Rule",
    category: "discipline",
    lesson: "If a task takes less than 2 minutes, do it immediately. Small undone tasks create mental weight that compounds into overwhelm.",
    whyItMatters: "Unfinished micro-tasks drain willpower and create a backlog of mental friction.",
    howToApply: "Before you plan your day, clear every sub-2-minute task from your list."
  },
  {
    title: "Protect the First Hour",
    category: "focus",
    lesson: "The first hour of your day sets the trajectory. Use it for your most important creative or strategic work—never for email or social media.",
    whyItMatters: "Morning willpower is highest. Using it on reactive tasks wastes your sharpest edge.",
    howToApply: "Block your first working hour for deep work. No notifications, no inputs."
  },
  {
    title: "Decide Once, Execute Daily",
    category: "discipline",
    lesson: "Make decisions once and turn them into systems. Deciding what to eat, when to work out, or when to write every day is a waste of decision energy.",
    whyItMatters: "Every repeated decision is a tax on your willpower.",
    howToApply: "Pick one recurring decision and turn it into a non-negotiable schedule."
  },
  {
    title: "Ship Before Perfect",
    category: "execution",
    lesson: "Done is better than perfect. The market rewards speed and iteration, not polished plans that never launch.",
    whyItMatters: "Perfectionism kills more businesses than competition does.",
    howToApply: "Identify one project and set a hard deadline to ship an imperfect version this week."
  },
  {
    title: "Energy Management Over Time Management",
    category: "health",
    lesson: "You don't need more hours. You need more energy in the hours you have. Sleep, nutrition, and movement are productivity tools.",
    whyItMatters: "A burned-out person with 16 hours produces less than a rested person with 8.",
    howToApply: "Identify your peak energy hours and schedule your hardest work there."
  },
  {
    title: "Build in Public",
    category: "content",
    lesson: "Share your process, not just your results. Documenting your journey attracts opportunities, accountability, and trust.",
    whyItMatters: "Transparency builds authority faster than polished marketing.",
    howToApply: "Post one honest insight from today's work—a lesson, a mistake, or a win."
  },
  {
    title: "Fear Is a Compass",
    category: "courage",
    lesson: "The thing you're most afraid to do is usually the thing you most need to do. Avoidance is a signal, not a strategy.",
    whyItMatters: "Growth lives on the other side of discomfort.",
    howToApply: "Name your biggest fear today and take one small action toward it."
  },
  {
    title: "Revenue Before Features",
    category: "business",
    lesson: "Don't build features. Build revenue paths. Every hour spent on a feature that doesn't drive revenue is a bet against your runway.",
    whyItMatters: "Businesses die from building the wrong things, not from building too little.",
    howToApply: "Before building anything new, ask: does this directly lead to revenue?"
  },
  {
    title: "Identity-Based Habits",
    category: "identity",
    lesson: "Don't focus on what you want to achieve. Focus on who you want to become. Habits stick when they're tied to identity.",
    whyItMatters: "Behavior that conflicts with self-image won't sustain itself.",
    howToApply: "Reframe one goal as an identity statement: 'I am someone who...' and act on it."
  },
  {
    title: "The 10/10/10 Rule",
    category: "long-term thinking",
    lesson: "Before making a decision, ask: How will I feel about this in 10 minutes? 10 months? 10 years? This separates impulse from wisdom.",
    whyItMatters: "Short-term comfort often creates long-term regret.",
    howToApply: "Apply this framework to one decision you're facing today."
  },
  {
    title: "Input Shapes Output",
    category: "focus",
    lesson: "Your creative output is a direct function of your inputs. Garbage in, garbage out. Curate what enters your mind as carefully as what you eat.",
    whyItMatters: "You can't produce premium work while consuming junk content.",
    howToApply: "Audit your last 24 hours of consumption. Remove one low-value source."
  },
  {
    title: "One Thing at a Time",
    category: "execution",
    lesson: "Multitasking is a myth. Context switching destroys deep thinking. The most productive people protect single-task focus ruthlessly.",
    whyItMatters: "Every task switch costs 15-25 minutes of refocus time.",
    howToApply: "Choose your ONE most important task and give it 90 minutes of unbroken focus."
  },
  {
    title: "Review Relentlessly",
    category: "discipline",
    lesson: "Without review, you repeat mistakes. Weekly reviews are not optional—they're the difference between learning and looping.",
    whyItMatters: "Unreviewed experience becomes unintentional repetition.",
    howToApply: "Schedule 30 minutes this week for a structured weekly review."
  },
  {
    title: "Constraints Create Freedom",
    category: "execution",
    lesson: "Infinite options cause paralysis. Set constraints—time limits, word counts, budgets—and watch your creativity and speed increase.",
    whyItMatters: "Structure eliminates decision fatigue and forces action.",
    howToApply: "Set a tight deadline on one open-ended task and deliver within it."
  },
  {
    title: "Relationships Are Leverage",
    category: "relationships",
    lesson: "The right relationship can compress years of effort into months. Invest in people who are where you want to be.",
    whyItMatters: "Isolation is the enemy of growth. Proximity to excellence is the fastest teacher.",
    howToApply: "Reach out to one person you admire or want to learn from today."
  },
  {
    title: "Master the Boring Fundamentals",
    category: "discipline",
    lesson: "Excellence isn't about exotic strategies. It's about executing boring fundamentals with abnormal consistency.",
    whyItMatters: "The gap between amateurs and pros is consistency, not complexity.",
    howToApply: "Identify one fundamental in your field and practice it with full attention today."
  },
  {
    title: "Write to Think",
    category: "focus",
    lesson: "Writing isn't just documentation—it's the highest form of thinking. If you can't write it clearly, you don't understand it yet.",
    whyItMatters: "Unclear thinking leads to unclear action.",
    howToApply: "Write 500 words about a problem you're stuck on. The answer will emerge."
  },
  {
    title: "Skin in the Game",
    category: "courage",
    lesson: "Commit resources—time, money, reputation—to your goals. Half-in produces half-results.",
    whyItMatters: "Commitment without sacrifice is just a wish.",
    howToApply: "Increase your stake in one goal. Make it uncomfortable to quit."
  },
  {
    title: "Stack Your Wins",
    category: "execution",
    lesson: "Start each day by completing one small, tangible task. Early wins create momentum that compounds throughout the day.",
    whyItMatters: "Momentum is the most underrated force in productivity.",
    howToApply: "Complete your easiest important task in the first 30 minutes of work."
  },
  {
    title: "Compound Knowledge",
    category: "long-term thinking",
    lesson: "Read, study, and learn every day. Knowledge compounds like interest. One insight per day is 365 insights per year.",
    whyItMatters: "The best investment always has the same ticker symbol: YOU.",
    howToApply: "Read for 20 minutes today in a subject that serves your 5-year vision."
  },
  {
    title: "Audit Your Calendar",
    category: "discipline",
    lesson: "Your calendar doesn't lie. If your biggest goal doesn't have time blocked for it, it's not a real goal—it's a wish.",
    whyItMatters: "What gets scheduled gets done.",
    howToApply: "Block time for your top priority this week. Protect it like a meeting with your most important client."
  },
  {
    title: "Sell Before You Build",
    category: "business",
    lesson: "Validate demand before you invest in creation. Pre-sell, get commitments, or run experiments before going all in.",
    whyItMatters: "Building without validation is the most expensive form of procrastination.",
    howToApply: "Before your next project, find 3 people willing to pay for it."
  },
  {
    title: "Emotional Fitness",
    category: "health",
    lesson: "Your emotions are data, not commands. Learn to observe them without being controlled by them.",
    whyItMatters: "Emotional reactivity derails more plans than external obstacles.",
    howToApply: "When a strong emotion hits today, pause for 90 seconds before responding."
  },
  {
    title: "Be the Bottleneck Breaker",
    category: "execution",
    lesson: "In any system, progress is limited by the biggest bottleneck. Find it, fix it, and everything accelerates.",
    whyItMatters: "Optimizing anything other than the bottleneck is wasted effort.",
    howToApply: "Identify the #1 bottleneck in your most important project and work on it today."
  },
  {
    title: "Document Everything",
    category: "content",
    lesson: "Your experiences, lessons, and insights are content. Document them consistently and you'll never run out of things to share.",
    whyItMatters: "Content is compounding equity. Every piece you don't create is value left on the table.",
    howToApply: "Capture 3 insights from today's work in your brainstorm vault."
  },
  {
    title: "The Power of No",
    category: "focus",
    lesson: "Every yes to something unimportant is a no to something that matters. Protect your time like it's your most valuable asset—because it is.",
    whyItMatters: "Overcommitment is the slow death of all ambition.",
    howToApply: "Decline or defer one request today that doesn't serve your mission."
  },
  {
    title: "Environment Design",
    category: "discipline",
    lesson: "Don't rely on willpower. Design your environment so the right behavior is the easiest behavior.",
    whyItMatters: "Willpower is finite. Environment is infinite.",
    howToApply: "Change one thing in your workspace that makes your desired behavior easier."
  },
  {
    title: "Progress Over Perfection",
    category: "execution",
    lesson: "Track forward movement, not flawless execution. A 1% improvement daily is a 37x improvement in a year.",
    whyItMatters: "Perfection is the enemy of progress, and progress is the only thing that matters.",
    howToApply: "At the end of today, measure what moved forward—not what was perfect."
  },
  {
    title: "Think in Systems",
    category: "long-term thinking",
    lesson: "Goals are for setting direction. Systems are for making progress. Winners build systems; losers set goals and hope.",
    whyItMatters: "A good system outperforms a great goal every time.",
    howToApply: "Convert one current goal into a repeatable system with clear triggers and routines."
  },
  {
    title: "Rest as Strategy",
    category: "health",
    lesson: "Strategic rest is not laziness. It's recovery that enables sustained high performance. Schedule it or your body will force it.",
    whyItMatters: "Burnout doesn't announce itself. It arrives disguised as declining output.",
    howToApply: "Schedule one block of genuine rest today. No screens, no inputs, no guilt."
  },
  {
    title: "Own Your Narrative",
    category: "identity",
    lesson: "The story you tell yourself about yourself becomes your reality. Rewrite limiting narratives with evidence of your growth.",
    whyItMatters: "Self-talk is the most powerful persuasion you'll ever encounter.",
    howToApply: "Catch one negative self-narrative today and replace it with a fact-based counter."
  }
];

export function getDailyAdvice(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  return DAILY_ADVICE[dayOfYear % DAILY_ADVICE.length];
}

export default DAILY_ADVICE;
