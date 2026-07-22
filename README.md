# Winnersbookmark Social Mastery

**Build Confidence. Master Conversation. Create Real Connection.**

A polished, mobile-first, **game-based learning app for real-world social skills** —
confidence, conversation, charisma, presence, listening, storytelling, body language,
making friends, networking, dating communication, relationships, public speaking,
leadership, and emotional intelligence.

Inspired by the learning mechanics of Duolingo-style apps (visual paths, short
sequential lessons, locked/unlocked progression, XP, streaks, daily practice), but an
**original product** with its own brand, curriculum, gamification, and AI role-play
coach. All content teaches **ethical communication** — confidence, respect,
authenticity, consent, curiosity, and boundaries. No manipulation or "pickup" tactics.

Built with **Vite + React + Tailwind CSS**. All progress persists in the browser
(`localStorage`) — close the app and return exactly where you left off. No backend
required to run the prototype; integration points are clearly marked for AI and billing.

---

## The core loop

`Learn → Practice → Role-play → Real-world challenge → Reflect → Earn XP → Unlock next skill`

The app rewards real practice, not passive consumption.

## Features

- **Onboarding assessment** → a 0–1000 Social Mastery baseline (radar chart) + a
  personalized 30-day path from your goals.
- **Home dashboard** — greeting, streak, XP, level, daily goal, "continue your
  journey", and today's real-world challenge.
- **12 academies / ~90 lessons** with a vertical, game-style progression map:
  completed / current / unlocked / locked states, plus a **Skill Boss** milestone
  per academy.
- **Interactive lesson engine** — Hook → Core Idea → Example → Bad vs. Better →
  Quiz → Micro-Challenge → Reflection → XP reward. Every lesson is playable
  (authored content where provided, coherent generated content elsewhere).
- **AI Social Coach (flagship)** — practice real conversations (coffee shop,
  networking, first date, interview, difficult coworker, raise, new friend,
  rejection) against simulated personalities, then get a **Social Performance
  Report** (9-metric breakdown, strengths, improvements, a stronger response, and a
  recommended lesson). Runs on a local mock engine with the model integration point
  clearly marked.
- **Daily missions** across four tiers (Easy → Elite) with required reflection.
- **Gamification** — XP, 10 named levels (Observer → Social Master), daily streaks,
  and 12 achievements that unlock automatically.
- **Insights dashboard** — mastery score, skill radar (now vs. start), strongest /
  weakest / fastest-improving skill, weekly activity, and per-skill bars.
- **Social Journal** — structured reflections with tags and heuristic weekly insights.
- **Profile** — achievements, rank ladder, Premium tier (demo toggle; billing
  integration point), and accessibility settings (reduced motion, notifications).

## Tech stack

- **Vite 5** + **React 18** + **React Router 6** (route-level code splitting)
- **Tailwind CSS 3** — obsidian / ivory / antique-gold / amber design system
- **lucide-react** — icons (explicitly registered so the bundle stays lean)
- Fonts: **Playfair Display** (display) + **Inter** (UI)

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Project structure

```
src/
  mastery/
    MasteryApp.jsx        Router, onboarding gate, global achievement toasts
    state/store.jsx       Context + reducer + localStorage; XP/level/streak/skill logic
    data/
      curriculum.js       12 academies, lessons, and the lesson-content engine
      levels.js           XP → level progression
      achievements.js     Achievement definitions + auto-unlock predicates
      challenges.js       Real-world missions (Easy → Elite) + daily pick
      scenarios.js        AI role-play scenarios, mock engine, scoring rubric
      onboarding.js       Assessment questions → baseline + 30-day path
    components/ui.jsx      Icon, brand, XP bar, rings, radar, nav, toast, etc.
    screens/              One file per screen (Home, Learn, Lesson, Coach, …)
  index.css               Tailwind layers + design-system component classes
  main.jsx                App entry (renders MasteryApp)
```

> The earlier "Daily Blogs" prototype files remain in `src/pages`, `src/components`,
> and `src/data` but are no longer routed; `main.jsx` now renders the Social Mastery app.

## Integration points (marked in code, no secrets in the client)

- **Live AI coach** — `src/mastery/data/scenarios.js` → `replaceMockReply()`. Wire
  this to your own backend route (e.g. the Claude Messages API) and keep the persona +
  rubric shape so scoring and UI are unchanged. Never put an API key in client code.
- **Billing** — `Profile.jsx` Premium card. Connect Stripe or app-store billing
  behind the demo toggle; use environment variables, never hard-coded credentials.

## Accessibility

Readable sizes, high-contrast palette, large tap targets, `aria` labels on
controls, and a **reduced-motion** setting (also honoring `prefers-reduced-motion`).

---

Designed by **Winnersbookmark Incorporated**.
