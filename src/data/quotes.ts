export const DAILY_QUOTES = [
  { text: 'Discipline is choosing what you want most over what you want now.', author: 'Winners Bookmark' },
  { text: 'Your body is the project. Treat it like one.', author: 'Winners Bookmark' },
  { text: 'Every rep counts. Not because someone is watching — because you are.', author: 'Winners Bookmark' },
  { text: 'Comfort is the enemy of progress. Choose discomfort with intention.', author: 'Winners Bookmark' },
  { text: 'The man who shows up consistently beats the man who shows up brilliantly — occasionally.', author: 'Winners Bookmark' },
  { text: 'Strength is built in the gym. Character is built in the decision to go.', author: 'Winners Bookmark' },
  { text: 'Eat like your goals matter. Train like your standards matter. Rest like your recovery matters.', author: 'Winners Bookmark' },
  { text: 'The barbell does not care how you feel today. Lift it anyway.', author: 'Winners Bookmark' },
  { text: 'Great physiques are built by the men who do the boring work, beautifully.', author: 'Winners Bookmark' },
  { text: 'Progress is not linear. Commitment is.', author: 'Winners Bookmark' },
  { text: 'The version of you that exists in a year is determined by the decisions you make today.', author: 'Winners Bookmark' },
  { text: 'You are either building or declining. There is no staying the same.', author: 'Winners Bookmark' },
  { text: 'Elite results are simply consistency applied over enough time.', author: 'Winners Bookmark' },
  { text: 'Your potential is not limited by your starting point. It is limited by your consistency.', author: 'Winners Bookmark' },
  { text: 'Train hard. Sleep hard. Eat hard. The results are a given.', author: 'Winners Bookmark' },
  { text: 'A bad workout is worth infinitely more than a skipped one.', author: 'Winners Bookmark' },
  { text: 'The men who transform their bodies are not special. They are decided.', author: 'Winners Bookmark' },
  { text: 'Control what you can. Execute with precision. Adapt when necessary.', author: 'Winners Bookmark' },
  { text: 'Your only competition is the man you were yesterday.', author: 'Winners Bookmark' },
  { text: 'Precision beats intensity. Consistency beats both.', author: 'Winners Bookmark' },
  { text: 'A plan followed imperfectly beats a perfect plan abandoned.', author: 'Winners Bookmark' },
  { text: 'The strongest version of you is not a destination. It is a practice.', author: 'Winners Bookmark' },
  { text: 'Champions train their discipline first. The body follows.', author: 'Winners Bookmark' },
  { text: 'Set the standard. Hold the standard. Raise the standard.', author: 'Winners Bookmark' },
  { text: 'Recovery is not weakness. It is part of the program.', author: 'Winners Bookmark' },
  { text: 'Do the work in private. Let the results speak in public.', author: 'Winners Bookmark' },
  { text: 'Every meal is a choice. Every choice is a vote for who you are becoming.', author: 'Winners Bookmark' },
  { text: 'Not motivation. Not inspiration. Commitment.', author: 'Winners Bookmark' },
  { text: 'The war is won in the kitchen. The battle is won in the gym. The foundation is won in the bed.', author: 'Winners Bookmark' },
  { text: 'You have already started. Keep going.', author: 'Winners Bookmark' },
];

export function getDailyQuote(): { text: string; author: string } {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}
