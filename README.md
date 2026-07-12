# Winnersbookmark Daily Blogs

**Daily Discipline. Strategic Growth. Built for Winners.**

A premium daily knowledge platform for men who want to become stronger,
wiser, healthier, more disciplined, and more successful every day — by
**Keith Warren / Winners Bookmark Incorporated**.

Every day: a new blog, lesson, fitness standard, nutrition move, money habit,
book insight, mentor lesson, AI productivity tip, and reflection question.
Every month: the mentors, books, theme, challenges, and standards rotate.
Nothing stays stale.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — luxury masculine design system (black, charcoal,
  espresso, cream, antique gold, bronze; green/ember/steel accents)
- **Lucide** icons · **Framer Motion** (single tasteful scroll reveal)
- Static data layer in `/data` (CMS-ready) · SEO metadata per route
- Placeholder auth, Stripe checkout, Gumroad checkout, and admin dashboard
- Ready for **Vercel** deployment

## Getting Started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Structure

```
app/          18 routes — home, today, blog, blog/[slug], categories, books,
              mentors, monthly-rotation, fitness, nutrition, money,
              ai-productivity, membership, login, dashboard, admin, about,
              contact (+ 404)
components/   layout/ sections/ cards/ ui/
data/         dailyKnowledge, articles, categories, monthlyBooks,
              monthlyMentors, challenges, dashboard, lifestyleCards
lib/          utils (cn, date formatting)
public/images Final photography drop zone (see its README)
```

## Rotation System

- **Daily:** edit `data/dailyKnowledge.ts` and publish a new entry in
  `data/articles.ts`.
- **Monthly:** swap `data/monthlyMentors.ts`, `data/monthlyBooks.ts`, and
  `data/challenges.ts` — every section and page updates automatically.

## Pending Integrations (placeholders in place, commented in code)

- Payments: Stripe subscription checkout + Gumroad product link
  (`app/membership/page.tsx`)
- Authentication: NextAuth/Clerk (`app/login/page.tsx`)
- CMS/database to replace `/data` (`app/admin/page.tsx`)
- Final photography (`public/images/README.md`)

---

*Designed by Winnersbookmark Incorporated*
