// Central brand + business configuration for Winners Bookmark Daily Blogs.
// Edit these values to customize the site without touching components.

export const site = {
  name: 'Winners Bookmark',
  fullName: 'Winners Bookmark Daily Blogs',
  tagline: 'Daily tools for discipline, focus, strength, money, self-mastery, and purpose.',
  promise:
    'A premium men’s improvement platform delivering powerful daily content on mindset, books, fitness, nutrition, money, leadership, and masculine development.',
  publisher: 'Winnersbookmark Incorporated',
  email: 'hello@winnersbookmark.com',
  postTime: '7:00 AM',
  founded: 2026,

  pricing: {
    price: 10,
    period: 'month',
    currency: 'USD',
    trialDays: 7,
  },

  // Replace these placeholders with your live checkout links.
  checkout: {
    // Gumroad product / membership URL
    gumroad: 'https://gumroad.com/l/winnersbookmark',
    // Stripe payment / subscription link
    stripe: 'https://buy.stripe.com/winnersbookmark',
  },

  social: {
    x: 'https://x.com/winnersbookmark',
    instagram: 'https://instagram.com/winnersbookmark',
    youtube: 'https://youtube.com/@winnersbookmark',
    tiktok: 'https://tiktok.com/@winnersbookmark',
  },
};

export const nav = [
  { label: 'Home', to: '/' },
  { label: 'Blog', to: '/blog' },
  { label: 'Categories', to: '/categories' },
  { label: 'Books', to: '/books' },
  { label: 'Mentors', to: '/mentors' },
  { label: 'Membership', to: '/membership' },
  { label: 'AI Secretary', to: '/virtual-secretary' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

export const memberBenefits = [
  'New premium content published daily at 7:00 AM',
  'Long-form deep dives (8,000–15,000 words)',
  'Full book breakdowns and applied strategy',
  'Mentor biographies and signature playbooks',
  'Visual learning: infographics and insight cards',
  'Complete searchable archive and topic collections',
  'Fitness, nutrition, and money systems for men',
  'Cancel anytime — no contracts, no friction',
];

export const trustBullets = [
  'Daily premium articles',
  'Book breakdowns and life lessons',
  'Fitness, nutrition, and money content',
  'Mentor biographies and visual infographics',
  `$${10}/month membership`,
];
