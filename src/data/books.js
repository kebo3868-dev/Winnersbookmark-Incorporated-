// Book / deep-dive library. `cover` is a placeholder color block until you
// add real cover imagery. `postSlug` links to a full breakdown article.
export const books = [
  {
    slug: 'deep-work',
    title: 'Deep Work',
    author: 'Cal Newport',
    accent: 'electric',
    themes: ['Focus', 'Productivity', 'Self-Mastery'],
    summary:
      'A manifesto for focused success in a distracted world. Newport argues that the ability to concentrate without distraction is the economic superpower of our age — and gives men a system to train it.',
    lesson:
      'Schedule deep work like a non-negotiable appointment. Treat shallow tasks as the exception, not the default.',
    postSlug: 'deep-work-blueprint-for-focus',
  },
  {
    slug: '48-laws-of-power',
    title: 'The 48 Laws of Power',
    author: 'Robert Greene',
    accent: 'gold',
    themes: ['Strategy', 'Leadership', 'Human Nature'],
    summary:
      'A ruthless, historical study of how power actually operates. Not an instruction manual for manipulation, but a field guide to seeing the game clearly so you’re never a pawn in it.',
    lesson:
      'Master your emotions, guard your reputation, and never outshine the master — until you are the master.',
    postSlug: '48-laws-of-power-for-real-men',
  },
  {
    slug: 'atomic-habits',
    title: 'Atomic Habits',
    author: 'James Clear',
    accent: 'crimson',
    themes: ['Habits', 'Discipline', 'Identity'],
    summary:
      'The definitive modern playbook on behavior change. Clear shows that you don’t rise to your goals — you fall to your systems — and that identity is built one small vote at a time.',
    lesson:
      'Make it obvious, attractive, easy, and satisfying. Focus on becoming the type of man who does the habit.',
    postSlug: 'atomic-habits-and-identity',
  },
  {
    slug: 'relentless',
    title: 'Relentless',
    author: 'Tim Grover',
    accent: 'crimson',
    themes: ['Mental Toughness', 'Discipline', 'Performance'],
    summary:
      'The trainer of Jordan and Kobe reveals the mindset of unstoppable competitors. Grover divides performers into Coolers, Closers, and Cleaners — and shows what separates the relentless few.',
    lesson:
      'Stop seeking comfort and balance. Trust your instincts, do the work no one sees, and own the outcome.',
    postSlug: null,
  },
  {
    slug: 'think-and-grow-rich',
    title: 'Think and Grow Rich',
    author: 'Napoleon Hill',
    accent: 'gold',
    themes: ['Money', 'Mindset', 'Purpose'],
    summary:
      'The original success philosophy, distilled from 20 years studying the wealthiest men in America. Hill maps the inner mechanics of achievement: desire, faith, planning, and persistence.',
    lesson:
      'Set a definite chief aim, back it with a burning desire, and organize your entire life around it.',
    postSlug: null,
  },
  {
    slug: 'meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    accent: 'gold',
    themes: ['Stoicism', 'Self-Mastery', 'Purpose'],
    summary:
      'The private journal of a Roman emperor governing himself under immense pressure. Two thousand years later it remains the most practical handbook ever written on emotional control and duty.',
    lesson:
      'Control what you can — your judgments and actions. Accept the rest. The obstacle is the way.',
    postSlug: null,
  },
];

export const bookBySlug = (slug) => books.find((b) => b.slug === slug);
