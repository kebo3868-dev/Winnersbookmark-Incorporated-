export const NAV_SECTIONS = [
  { key: 'home', label: 'Home', path: '/' },
  { key: 'daily', label: 'Daily Mission', path: '/daily-mission' },
  { key: 'roadmap', label: '12-Month Roadmap', path: '/roadmap' },
  { key: 'ai', label: 'AI Mastery', path: '/ai-mastery' },
  { key: 'business', label: 'Business Builder', path: '/business-builder' },
  { key: 'content', label: 'Content System', path: '/content-system' },
  { key: 'fitness', label: 'Fitness & Health', path: '/fitness-health' },
  { key: 'money', label: 'Money & Wealth', path: '/money-wealth' },
  { key: 'relationships', label: 'Relationships', path: '/relationships' },
  { key: 'travel', label: 'Travel Planner', path: '/travel-planner' },
  { key: 'legacy', label: 'Legacy Builder', path: '/legacy-builder' },
  { key: 'weekly', label: 'Weekly Review', path: '/weekly-review' },
  { key: 'monthly', label: 'Monthly Review', path: '/monthly-review' },
  { key: 'progress', label: 'Progress Dashboard', path: '/progress' },
  { key: 'profile', label: 'Profile / Settings', path: '/profile' },
];

export const BLACK_FLAME_QUOTES = [
  'Execution beats intention.',
  'Small wins compound.',
  'Build proof.',
  'Protect your energy.',
  'No drift.',
  'One promise kept today.',
  'Win the day before the day wins you.',
];

export const dailyMissionDefaults = [
  'Today\'s AI task',
  'Today\'s business task',
  'Today\'s content task',
  'Today\'s workout',
  'Today\'s money action',
  'Today\'s relationship action',
  'Today\'s discipline promise',
].map((text, idx) => ({ id: `mission-${idx + 1}`, text, completed: false }));

export const roadmapDefaults = [
  'ChatGPT fundamentals',
  'Prompt engineering',
  'Claude and Gemini workflows',
  'AI research and summarization',
  'AI automation basics',
  'AI for local business',
  'AI chatbot fundamentals',
  'AI content systems',
  'AI consulting offers',
  'Client delivery systems',
  'Case studies and testimonials',
  'Portfolio and sales system',
].map((objective, idx) => ({
  id: `month-${idx + 1}`,
  month: idx + 1,
  objective,
  learningTasks: '',
  practiceProject: '',
  notes: '',
  complete: false,
  status: 'Not Started',
}));

export const aiTrackDefaults = [
  'ChatGPT basics','Prompt engineering','Claude workflows','Gemini workflows','AI research','AI automation','AI chatbots','AI content systems','AI for restaurants','AI consulting delivery','Case studies','Portfolio building'
].map((skill, idx) => ({
  id: `skill-${idx+1}`,
  skill,
  checklist: '',
  project: '',
  proofAsset: '',
  status: 'Not Started',
  notes: '',
}));

export const profileDefaults = {
  name: 'Keith Warren',
  age: 53,
  currentJob: 'Line Cook',
  mainMission: 'Become an AI consultant, content creator, teacher, and disciplined leader through Winnersbookmark Incorporated.',
  currentWeight: 168,
  goalWeight: 180,
  monthlyIncomeGoal: 10000,
  annualIncomeGoal: 120000,
  mainBusinessNiche: 'Restaurants and local service businesses',
  topValues: 'Discipline, Faith, Integrity',
  vision2: '',
  vision5: '',
  vision10: '',
  vision20: '',
  brand: 'Winnersbookmark Incorporated'
};

export const appDefaults = {
  dailyMission: dailyMissionDefaults,
  top3Priorities: ['', '', ''],
  wins: [],
  tasks: [],
  roadmap: roadmapDefaults,
  aiTracks: aiTrackDefaults,
  business: {
    niche: 'Restaurants',
    offer: 'Missed-call text-back system',
    clients: [],
    pricing: { setupFee: 0, monthlyRetainer: 0, projectedRevenue: 0, actualRevenue: 0 }
  },
  contentItems: [],
  fitness: { currentWeight: 168, goalWeight: 180, workoutDays: 0, strength: 0, cardio: 0, mobility: 0, waterDays: 0, sleepHours: 0, mealQuality: 0, energy: 0, refluxNotes: '' },
  money: { monthlyIncome: 0, monthlyExpenses: 0, savingsGoal: 10000, emergencyFund: 0, retirementContribution: 0, businessReinvestment: 0, travelFund: 0, debtBalance: 0 },
  relationships: { reconnect: '', newContacts: '', mentors: '', collaborators: '', socialGoals: '', communityGoals: '', monthlyActions: 0 },
  travel: [
    { id: crypto.randomUUID(), destination: 'Japan', estimatedCost: 0, safetyNotes: '', purpose: '', targetDate: '', savingsProgress: 0, status: 'Dreaming' },
    { id: crypto.randomUUID(), destination: 'Dominican Republic', estimatedCost: 0, safetyNotes: '', purpose: '', targetDate: '', savingsProgress: 0, status: 'Dreaming' },
    { id: crypto.randomUUID(), destination: 'Morocco', estimatedCost: 0, safetyNotes: '', purpose: '', targetDate: '', savingsProgress: 0, status: 'Dreaming' },
    { id: crypto.randomUUID(), destination: 'Colombia', estimatedCost: 0, safetyNotes: '', purpose: '', targetDate: '', savingsProgress: 0, status: 'Dreaming' },
  ],
  legacy: { books: '', courses: '', people: '', lessons: '', community: '', longTermVision: '', vision2: '', vision5: '', vision10: '', vision20: '' },
  weeklyReviews: [],
  monthlyReviews: [],
  profile: profileDefaults,
};

export const options = {
  niches: ['Restaurants', 'Barbershops', 'Med spas', 'Fitness businesses', 'Local service businesses'],
  offers: ['Missed-call text-back system', 'AI customer service chatbot', 'FAQ chatbot', 'Appointment booking assistant', 'Review request automation', 'Content creation system', 'Email follow-up system', 'Online order support system'],
  pipelineStatus: ['Lead', 'Contacted', 'Call Booked', 'Proposal Sent', 'Closed', 'Lost'],
  platforms: ['TikTok', 'Instagram', 'YouTube Shorts', 'YouTube', 'Blog', 'Email Newsletter'],
  pillars: ['AI for beginners', 'Discipline', 'Fitness for men', 'Money and self-improvement', 'Business automation', 'Travel and lifestyle', 'The Black Flame mindset'],
  roadmapStatus: ['Not Started', 'In Progress', 'Complete'],
  travelStatus: ['Dreaming', 'Planning', 'Funded', 'Booked', 'Completed']
};
