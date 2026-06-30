# Winners Bookmark Daily Blogs

A premium men’s self-improvement **media brand + subscription content platform**.
Daily, visual, cinematic content on discipline, focus, power, money, fitness,
nutrition, purpose, books, biographies, and self-mastery — for men ages 18–70.

> **Brand promise:** Daily tools for discipline, focus, strength, money, self-mastery, and purpose.

Built with **Vite + React + Tailwind CSS** as a fast, responsive, SEO-friendly,
conversion-focused front end. Monetized at **$10/month with a 7-day free trial**,
with **Gumroad + Stripe** checkout integration points wired in.

---

## Tech stack

- **Vite 5** — fast dev server + optimized production build
- **React 18** + **React Router 6** — multi-page SPA, route-level code splitting
- **Tailwind CSS 3** — premium dark/gold/electric design system
- **lucide-react** — icon set
- Fonts: **Playfair Display** (display), **Inter** (body), **Bebas Neue** (accent)

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Pages

| Route | Page |
|---|---|
| `/` | Home — hero, featured today, pillars, deep dives, books, mentors, vision board, membership CTA |
| `/blog` | Blog index — search, category filters, featured article |
| `/blog/:slug` | Single article template — TOC, reading progress, takeaways, action steps, callouts, paywall, related |
| `/categories` | Category hub |
| `/categories/:slug` | Category detail — articles in a pillar |
| `/books` | Books / Deep Dives library |
| `/mentors` | Mentor / biography library |
| `/mentors/:slug` | Mentor profile — biography, signature ideas |
| `/membership` | Pricing, benefits, Stripe + Gumroad checkout, FAQ |
| `/about` | Brand story & mission |
| `/contact` | Contact form + links |

## Project structure

```
src/
  data/         Content & config — edit these to customize the site
    site.js        Brand name, pricing, checkout links, nav, benefits
    categories.js  The 12 content pillars
    posts.js       Articles (block-based body model)
    books.js       Book / deep-dive library
    mentors.js     Mentor biographies
  components/    Reusable UI (NavBar, Footer, cards, ArticleBody, CTAs…)
  pages/         One file per route
  lib/           Helpers (formatting, document meta, accent classes)
  index.css      Tailwind layers + the design-system component classes
```

## Customize it later

Everything content-related lives in `src/data/` — you rarely need to touch
components:

- **Brand, price, trial, checkout links** → `src/data/site.js`
  (set `site.checkout.stripe` and `site.checkout.gumroad` to your real URLs).
- **Add an article** → push a new object onto the array in `src/data/posts.js`.
  Each post’s `body` is an array of typed blocks (`p`, `h2`, `quote`, `list`,
  `image`, `takeaways`, `actions`, `callout`, `lesson`, `meaning`, `divider`)
  rendered by `components/ArticleBody.jsx`. Set `tier: 'member'` to gate it
  behind the paywall, or `tier: 'free'` to keep it open.
- **Add a category / book / mentor** → append to the matching file in `src/data/`.
- **Swap in real imagery** → every `<ImagePlaceholder>` is a labeled drop-in
  slot. Replace with `<img>` tags or set the `image` field on mentors/books.

### Daily publishing

The product publishes a new article **daily at 7:00 AM**. The front end is ready
for that workflow: add the day’s post to `posts.js` (the homepage “Featured
Today” slot and the blog index both sort by date automatically), or wire
`posts.js` to a CMS/headless source when you move beyond the static prototype.

## Monetization

- **Model:** $10/month subscription, 7-day free trial, cancel anytime.
- **Checkout:** `components/CheckoutButtons.jsx` renders Stripe + Gumroad entry
  points; URLs come from `site.checkout`. Member-tier articles show a teaser then
  a paywall (`pages/BlogPost.jsx`) driving to those checkout options.

---

Designed by **Winnersbookmark Incorporated**.
