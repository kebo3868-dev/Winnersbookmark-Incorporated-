const DAILY_CROAKS = [
  {
    prompt: "If you repeated today for 3 years, where would you end up?",
    hardTruth: "Comfort is the most dangerous drug because it feels like peace.",
    reflection: "What are you tolerating that your future self will resent?",
    challenge: "Do the one thing you've been avoiding before noon."
  },
  {
    prompt: "Life is finite. What are you pretending can wait forever?",
    hardTruth: "Most people don't lack time. They lack the courage to use it honestly.",
    reflection: "If today were your last, what would you regret not starting?",
    challenge: "Write down the decision you've been postponing and make it today."
  },
  {
    prompt: "What obvious move are you delaying because comfort is winning?",
    hardTruth: "Your daily habits are a confession of your actual priorities.",
    reflection: "Are you building the life you want or maintaining the one you fell into?",
    challenge: "Replace one hour of consumption with one hour of creation."
  },
  {
    prompt: "You are not promised tomorrow. Did today earn its place in your story?",
    hardTruth: "Potential without execution is just a comfortable form of failure.",
    reflection: "What lie are you telling yourself to avoid discomfort?",
    challenge: "Have the conversation you've been avoiding."
  },
  {
    prompt: "In 10 years, will you remember this week? Make it worth remembering.",
    hardTruth: "Nobody is coming to save you. Nobody is coming to build it for you.",
    reflection: "What would you do differently if no one was watching?",
    challenge: "Eliminate one distraction permanently today."
  },
  {
    prompt: "Every day you don't act, the gap between who you are and who you could be widens.",
    hardTruth: "Overthinking is the most productive-looking form of procrastination.",
    reflection: "What fear is disguised as logic in your decision-making?",
    challenge: "Ship something imperfect instead of perfecting something invisible."
  },
  {
    prompt: "Death doesn't negotiate. Neither should you with mediocrity.",
    hardTruth: "You can't think your way to a better life. You have to act your way there.",
    reflection: "Where are you choosing safety over growth?",
    challenge: "Do something today that scares you slightly."
  },
  {
    prompt: "The graveyard is full of unwritten books, unlaunched businesses, and unsaid words.",
    hardTruth: "Busy is not productive. Motion is not progress. Activity is not achievement.",
    reflection: "What would your 80-year-old self say about how you spent this week?",
    challenge: "Block 2 hours of deep work with zero interruptions."
  },
  {
    prompt: "You will die. Before that, will you have lived deliberately?",
    hardTruth: "Most regrets come from inaction, not from mistakes.",
    reflection: "What are you doing out of obligation that you should do out of intention?",
    challenge: "Say no to something that doesn't serve your mission."
  },
  {
    prompt: "Time is the only resource you can never earn back. How did you spend it today?",
    hardTruth: "Discipline feels like punishment only to those who haven't tasted its rewards.",
    reflection: "If you could only accomplish one thing this year, what would it be?",
    challenge: "Work on your most important goal for 90 uninterrupted minutes."
  },
  {
    prompt: "A year from now, you'll wish you had started today.",
    hardTruth: "Excuses are the nails used to build a house of failure.",
    reflection: "What would change if you treated your time as your most expensive asset?",
    challenge: "Audit your screen time and reclaim one wasted hour."
  },
  {
    prompt: "The clock is ticking regardless. Are you building or just existing?",
    hardTruth: "You don't rise to the level of your goals. You fall to the level of your systems.",
    reflection: "What system is broken in your life that you keep ignoring?",
    challenge: "Design or fix one personal system today."
  },
  {
    prompt: "Memento mori. Remember you will die. Now go live accordingly.",
    hardTruth: "Comfort zones are where ambitions go to die quietly.",
    reflection: "What would you pursue if you knew you couldn't fail?",
    challenge: "Take the first step on a project you've been planning for months."
  },
  {
    prompt: "Every sunset is a deadline. What did you deliver today?",
    hardTruth: "Talent is common. Discipline is rare. That's why most talented people are broke.",
    reflection: "Are your actions aligned with your stated values?",
    challenge: "Complete one task you've been pushing to tomorrow."
  },
  {
    prompt: "You're not too busy. You're just not committed enough to what matters.",
    hardTruth: "Planning without execution is entertainment. Execution without planning is chaos.",
    reflection: "What would someone who has their life together do today?",
    challenge: "Identify your #1 priority and protect 3 hours for it."
  },
  {
    prompt: "The person you want to become is waiting on the other side of discipline.",
    hardTruth: "You already know what to do. You're just not doing it.",
    reflection: "What habit, if installed permanently, would transform your next 5 years?",
    challenge: "Commit to one new daily habit starting now. Keep it small."
  },
  {
    prompt: "Don't count the days. Make the days count.",
    hardTruth: "Your environment is either pulling you forward or dragging you back. There is no neutral.",
    reflection: "What in your environment is silently sabotaging your progress?",
    challenge: "Remove one friction point from your daily routine."
  },
  {
    prompt: "Legacy is not built in a day. But it is lost in one.",
    hardTruth: "The market doesn't care about your intentions. It rewards execution.",
    reflection: "What would your children (or future children) think of how you spent today?",
    challenge: "Do one thing today that serves your 10-year vision."
  },
  {
    prompt: "Someday is not a day of the week.",
    hardTruth: "Waiting for the perfect moment is the strategy of people who never start.",
    reflection: "What 'someday' goal can you take one real step toward today?",
    challenge: "Convert one vague dream into a specific 90-day objective."
  },
  {
    prompt: "You are either building your dream or building someone else's.",
    hardTruth: "Average effort produces average results, no matter how smart you are.",
    reflection: "How much of your day was intentional vs. reactive?",
    challenge: "Plan tomorrow tonight with specific time blocks."
  },
  {
    prompt: "The best time to plant a tree was 20 years ago. The second best time is now.",
    hardTruth: "Information without implementation is just intellectual entertainment.",
    reflection: "What have you learned this week that you haven't applied?",
    challenge: "Apply one lesson you've been sitting on."
  },
  {
    prompt: "Your future is being written right now. What story are your actions telling?",
    hardTruth: "People don't lack motivation. They lack clarity and courage.",
    reflection: "What is one truth you've been avoiding because it demands change?",
    challenge: "Write a letter to your future self about what you commit to today."
  },
  {
    prompt: "Momentum doesn't knock. You have to build it brick by brick.",
    hardTruth: "Distraction is not accidental. It's the path of least resistance, and it leads nowhere.",
    reflection: "What are you most distracted by, and what is it costing you?",
    challenge: "Go 4 hours without checking social media or news."
  },
  {
    prompt: "Don't let the noise of others' opinions drown out your inner clarity.",
    hardTruth: "If you don't define your day, the world will define it for you.",
    reflection: "Whose approval are you seeking that you should be seeking your own?",
    challenge: "Make one decision today based entirely on your own judgment."
  },
  {
    prompt: "Pain is temporary. Regret is permanent.",
    hardTruth: "Complaining is a substitute for action. Choose one.",
    reflection: "What complaint can you convert into a commitment today?",
    challenge: "Catch yourself complaining and replace it with a plan."
  },
  {
    prompt: "The gap between where you are and where you want to be is called discipline.",
    hardTruth: "You are the average of your five most repeated daily actions, not your five best intentions.",
    reflection: "What are your five most repeated daily actions? Do they match your ambitions?",
    challenge: "Replace one low-value daily action with a high-value one."
  },
  {
    prompt: "Nobody remembers the man who played it safe.",
    hardTruth: "The only real security comes from being so valuable you can't be ignored.",
    reflection: "What skill or output, if 10x'd, would change everything?",
    challenge: "Spend 30 minutes deliberately practicing your most valuable skill."
  },
  {
    prompt: "Stop rehearsing your future and start performing in your present.",
    hardTruth: "Most people overestimate what they can do in a day and underestimate what they can do in a year.",
    reflection: "What small daily action would compound into something extraordinary over a year?",
    challenge: "Commit to one non-negotiable daily action. Execute it today."
  },
  {
    prompt: "Clarity comes from action, not thought.",
    hardTruth: "You don't need more ideas. You need more finished projects.",
    reflection: "What unfinished project deserves your focus this week?",
    challenge: "Identify one project to finish and schedule 3 work sessions for it."
  },
  {
    prompt: "The world rewards those who ship, not those who plan.",
    hardTruth: "Perfectionism is fear wearing a productivity mask.",
    reflection: "What are you over-polishing that should have been released already?",
    challenge: "Publish, ship, or share one piece of work today—imperfect is fine."
  },
  {
    prompt: "Your obituary won't mention your Netflix watch history.",
    hardTruth: "Rest is necessary. Laziness disguised as rest is destruction.",
    reflection: "How much of your 'rest' is actually avoidance?",
    challenge: "Earn your rest today by completing your hardest task first."
  }
];

export function getDailyCroak(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  return DAILY_CROAKS[dayOfYear % DAILY_CROAKS.length];
}

export default DAILY_CROAKS;
