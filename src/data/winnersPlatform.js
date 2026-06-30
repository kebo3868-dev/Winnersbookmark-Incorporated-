import { Brain, Dumbbell, Target, Wallet, BookOpen, Crown, Sparkles, Apple, Shield, Users } from 'lucide-react';

export const categories = [
  ['Discipline', Brain, 'Turn intention into repeatable daily evidence.'], ['Focus', Target, 'Protect attention and execute deep work blocks.'], ['Fitness', Dumbbell, 'Build strength, energy, and physical command.'], ['Nutrition', Apple, 'Simple fuel systems for working men.'], ['Money', Wallet, 'Budget, skill stack, and build leverage.'], ['Goal Setting', Shield, 'Convert ambition into 90-day missions.'], ['Leadership', Crown, 'Lead yourself before asking others to follow.'], ['Books', BookOpen, 'Breakdowns that become action plans.'], ['Mentors', Users, 'Study proven operators and timeless lessons.'], ['AI Tools for Winners', Sparkles, 'Use prompts and automation to compound learning.']
];

export const blogPosts = [
  ['Discipline','Discipline Is the First Bookmark of a Winner','Most men do not fail because they lack dreams. They fail because they lack a daily system that turns intention into evidence.','7 min',false],
  ['Discipline','Discipline Is a System, Not a Mood','Build a morning command sequence that works when motivation disappears.','6 min',true],
  ['Focus','Deep Work for Men Who Want More','A practical protocol for protecting attention in a noisy world.','8 min',true],
  ['Leadership','The 48 Laws of Power for Modern Self-Control','Use strategic restraint, patience, and observation without becoming manipulative.','9 min',true],
  ['Fitness','Build a Body That Commands Respect','Strength training basics for confidence, energy, and discipline.','5 min',false],
  ['Money','Money Habits That Separate Men from Boys','Control spending, stack skills, and give every dollar a mission.','7 min',true],
  ['Goal Setting','How to Set Goals Like a Strategist','Replace wishes with timelines, scorecards, and accountability.','6 min',false],
  ['Mentors','The Jim Rohn Rule: Work Harder on Yourself','Personal development is the root system of every external win.','5 min',true],
  ['Mentors','Les Brown and the Psychology of Hunger','Ambition needs emotional fuel and a reason bigger than comfort.','5 min',true]
].map(([category,title,summary,readingTime,premium], id)=>({id, category,title,summary,readingTime,premium}));

export const books = ['Deep Work by Cal Newport','The 48 Laws of Power by Robert Greene','Atomic Habits by James Clear','Relentless by Tim Grover','Think and Grow Rich by Napoleon Hill','The Richest Man in Babylon by George S. Clason','Man’s Search for Meaning by Viktor Frankl','The War of Art by Steven Pressfield','Can’t Hurt Me by David Goggins','The 7 Habits of Highly Effective People by Stephen Covey'].map((title,i)=>({title, lesson:['Attention is a competitive advantage.','Power begins with self-command.','Tiny actions compound identity.','Excellence requires pressure.','Thought must become organized desire.'][i%5], reader:'Men building discipline, money skill, leadership, and emotional control.', challenge:'Apply one lesson for 24 hours and record evidence.'}));

export const mentors = ['Jim Rohn','Les Brown','Robert Greene','Tim Grover','Marcus Aurelius','David Goggins','Kobe Bryant','Michael Jordan','Tony Robbins','Napoleon Hill'].map((name,i)=>({name, lesson:['Work harder on yourself.','Stay hungry.','Think strategically.','Do the work nobody sees.','Control the inner state.'][i%5], quote:'Discipline beats mood when the mission is clear.', learn:'Model their standards, resilience, preparation, and ability to convert adversity into action.'}));

export const testimonials = ['This finally made self-improvement feel organized instead of random.','The daily missions gave me structure without fake hype.','I joined for motivation and stayed for the systems.'].map((quote,i)=>({quote, name:['Marcus T.','Andre W.','Caleb R.'][i], role:['Founder','Sales leader','Student athlete'][i]}));

export const faqs = ['Is this for beginners?','Do I need to be in shape?','Is this only motivation?','Can I cancel anytime?','What do I get every day?','Will there be AI tools and prompts?'].map(q=>({q,a:'Yes. Winners Bookmark is designed as a practical operating system with clear steps, premium lessons, and member-only execution prompts.'}));

export const dashboardStats = { streak: 18, weeklyScore: 84, goals: 67, saved: 12 };
