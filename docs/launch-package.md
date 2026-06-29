# Winners Bookmark Daily Blogs — Launch Package

Everything you need to take the platform from built to launched: brand copy,
site map, page copy, 30 launch articles, the content-production system, and the
daily 7:00 AM publishing workflow.

> All site copy already lives in `src/data/`. This document is the source playbook —
> paste pieces into the data files (or a future CMS) as you publish.

---

## 1. Brand foundation

| Element | Value |
|---|---|
| **Name** | Winners Bookmark Daily Blogs |
| **Promise** | Daily tools for discipline, focus, strength, money, self-mastery, and purpose. |
| **Audience** | Men 18–70 — ambitious, rebuilding, purpose-driven |
| **Price** | $10/month · 7-day free trial · cancel anytime |
| **Cadence** | Daily post at 7:00 AM (1,500–3,000 words) + weekly deep dive (8,000–15,000) |
| **Voice** | Cinematic, masculine, strategic, practical, elevated — never cheesy |
| **Publisher** | Winnersbookmark Incorporated |

**Tagline options**
1. Daily tools for discipline, focus, strength, money, and self-mastery. *(current)*
2. The daily operating system for serious men.
3. Sharpen the mind. Build the man. Every single day.

---

## 2. Site map

```
Home
├── Blog (index: search + filters + featured)
│   └── Article (template: TOC, progress, takeaways, action steps, paywall)
├── Categories (hub)
│   └── Category (discipline, focus, fitness, … 12 pillars)
├── Books / Deep Dives
│   └── Book breakdown → links to article
├── Mentors / Biographies
│   └── Mentor profile (bio + signature ideas)
├── Membership / Pricing (Stripe + Gumroad + FAQ)
├── About
└── Contact
```

**12 content pillars:** Discipline · Focus · Fitness · Nutrition · Money ·
Goal Setting · Self-Mastery · Book Breakdowns · Mentors & Biographies ·
Leadership · Purpose · Habits.

---

## 3. Homepage copy

**Hero headline:** Winners Bookmark Daily Blogs
**Subhead:** Daily insight for discipline, focus, strength, money, purpose, and self-mastery.
**Support:** A premium men's improvement platform delivering powerful daily content on mindset, books, fitness, nutrition, money, leadership, and masculine development.
**Primary CTA:** Start 7-Day Free Trial · **Secondary CTA:** Explore Today's Blog

**Trust bullets:** Daily premium articles · Book breakdowns & life lessons ·
Fitness, nutrition & money content · Mentor biographies & infographics · $10/month.

**Why this exists:** Modern men aren't short on information — they're drowning in
it and starving for structure. The internet is full of shallow motivation that's
useless by lunch. Winners Bookmark is the opposite: clear, strategic, deeply
useful content that builds a more disciplined, focused, stronger, sharper man.

**Membership band:** *Upgrade Your Mind Every Day* — Get premium daily content,
deep-dive breakdowns, visual learning tools, and self-mastery insights for just
$10/month. → Start Free Trial · See Membership Benefits.

---

## 4. About page (story)

**Headline:** Why Winners Bookmark Daily Blogs Exists.

A man becomes great the way he builds anything worthwhile — disciplined daily
reps, the right knowledge, and the company of ideas that pull him up. We combined
mindset, books, strategy, health, money, and masculine growth into one platform
with a single promise: daily tools for self-mastery. Not hype. Not fluff. A
serious curriculum for the man who refuses to drift — whether he's 18 or 70.

---

## 5. Membership / pricing copy

**Headline:** Daily Content for Men Who Refuse to Drift.
**Price:** $10/month — 7-day free trial — cancel anytime.

**Benefits:** new content daily at 7 AM · premium long-form deep dives · full book
breakdowns · mentor biographies & playbooks · visual infographics & insight cards ·
complete searchable archive · fitness/nutrition/money systems.

**FAQ:** what you get · free trial · cancel anytime · publishing cadence ·
beginner vs advanced · topics covered. *(All six answered on the live page.)*

---

## 6. First 30 launch articles

Mix of free (discovery/SEO) and member (paywalled) — and which pillar each feeds.

| # | Title | Pillar | Tier |
|---|---|---|---|
| 1 | Discipline Is Freedom in Practice | Discipline | Free ✅ shipped |
| 2 | Deep Work: A Modern Blueprint for Focus | Focus | Free ✅ shipped |
| 3 | Fitness as a Form of Masculine Discipline | Fitness | Free ✅ shipped |
| 4 | 10 Lessons From The 48 Laws of Power | Book Breakdowns | Member ✅ shipped |
| 5 | Atomic Habits and Identity Transformation | Habits | Member ✅ shipped |
| 6 | The Real Relationship Between Money and Self-Control | Money | Member ✅ shipped |
| 7 | Why Men Need Standards, Not Excuses | Self-Mastery | Free ✅ shipped |
| 8 | Nutrition: Fuel for the Mission | Nutrition | Free ✅ shipped |
| 9 | How to Rebuild Your Life With Structure | Purpose | Member ✅ shipped |
| 10 | The 5 AM Question: Who Are You When No One Is Watching? | Discipline | Free |
| 11 | Jim Rohn's Philosophy of Personal Responsibility | Mentors | Free |
| 12 | The Psychology of Masculine Purpose | Purpose | Member |
| 13 | How Men Build Financial Control (The First $10k) | Money | Member |
| 14 | Stoicism for the Modern Man: Meditations, Applied | Book Breakdowns | Member |
| 15 | The Compound Effect of Showing Up | Habits | Free |
| 16 | Train Like a Cleaner: Lessons from Relentless | Fitness | Member |
| 17 | Think and Grow Rich for Men Who Hate Hype | Money | Member |
| 18 | David Goggins and the Callousing of the Mind | Mentors | Free |
| 19 | Goal Setting That Actually Survives February | Goal Setting | Free |
| 20 | The Confidence That Comes from Kept Promises | Self-Mastery | Member |
| 21 | Lead Yourself First: The Foundation of Leadership | Leadership | Free |
| 22 | The Dopamine Detox a Man Actually Needs | Focus | Member |
| 23 | Sleep Is a Weapon: Recovery for High Performers | Fitness | Free |
| 24 | Robert Greene on Mastery and the Long Game | Mentors | Member |
| 25 | The Quiet Power of Doing Hard Things on Purpose | Discipline | Free |
| 26 | Money Scripts: The Beliefs Keeping Men Broke | Money | Member |
| 27 | How to Read 50 Books a Year (and Keep Them) | Habits | Free |
| 28 | The Man in the Arena: Purpose Over Approval | Purpose | Member |
| 29 | Cold Exposure, Discipline, and the Comfort Trap | Self-Mastery | Free |
| 30 | The Weekly Review Every Serious Man Should Run | Productivity | Free |

To add one: drop an object into `src/data/posts.js` using the existing block
model (`p`, `h2`, `quote`, `list`, `image`, `takeaways`, `actions`, `callout`,
`lesson`, `meaning`, `divider`). Set `tier: 'free'` or `'member'`.

---

## 7. Content-production system (one-to-many)

Write once, ship everywhere. From each daily article, extract:

- **1** blog post (the source of truth in `posts.js`)
- **5** quote cards (pull from `quote` blocks)
- **1** infographic (build from the `image` caption + `takeaways`)
- **3** TikToks/Reels (hook = opening line; payoff = one action step)
- **1** carousel (one slide per `h2` + the takeaways)
- **1** email (subtitle as subject line; takeaways as body; CTA to the post)
- **1** members-only summary (the `meaning` + `actions` blocks)

This turns one writing session into a full day of distribution and a reason to
subscribe — the article structure is already pre-cut for every format.

---

## 8. Daily 7:00 AM publishing workflow

**Prototype (today):**
1. Generate the article using the *Daily Article Template Prompt* (in README/your notes).
2. Add it as an object in `src/data/posts.js` with today's `date`.
3. `npm run build` → deploy. The homepage "Featured Today" and blog index both
   auto-sort by date, so the newest post leads automatically.
4. Schedule the deploy for 7:00 AM (host scheduler / GitHub Action / cron).

**At scale (next step):** move `posts.js` to a headless CMS or markdown folder with
a `publishAt` field and a scheduled build at 06:55 AM so the 7:00 drop is hands-off.

---

## 9. Go-live checklist

- [ ] Set real **Stripe** + **Gumroad** URLs in `src/data/site.js` → `site.checkout`
- [ ] Confirm Stripe product = $10/mo with a 7-day trial; Gumroad membership mirror
- [ ] Wire the **contact form** (`pages/Contact.jsx`) to an email service
- [ ] Replace `<ImagePlaceholder>` slots with real hero/cover/portrait imagery
- [ ] Point a domain at the deployed `dist/` and set OG/social images
- [ ] Load the first 9 articles (done) + queue 10–30 for the daily calendar
- [ ] Turn on the 7:00 AM scheduled build/deploy

---

Designed by **Winnersbookmark Incorporated**.
