# Codex MVP Build Prompt — Winner's Bookmark Daily

Start with repo inspection and MVP architecture only. After that, implement the app in small, working increments and keep the codebase runnable after each major step.

## Role
You are Codex operating as a senior full-stack engineer, product architect, UX strategist, and behavioral systems designer.

Build a production-minded MVP of a premium mobile-first journaling app called **WINNER'S BOOKMARK DAILY**.

## Core Objective
Build an MVP that drives this loop:
**Thought -> Decision -> Action -> Review -> Correction -> Progress**

## First Task: Repo Inspection (Required)
Before writing code, inspect and report:
1. framework + package manager
2. routing structure
3. styling setup
4. auth setup
5. database setup
6. reusable components
7. whether to build inside existing app or add new app structure

Then choose the **lowest-friction path**.

If repo conflicts with preferred stack, preserve existing architecture when practical.

## Preferred Stack (only if repo does not conflict)
- Next.js 15+ App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase (auth + db)
- Zod
- React Hook Form

## MVP Scope Only
Include:
- onboarding
- dashboard
- daily entry flow
- goals & vision
- system builder
- brainstorm vault
- reviews
- insights
- persistence
- seeded daily croaks
- seeded daily advice
- basic alignment scoring

Do **not** add:
- payments
- social/community
- heavy notifications
- heavy gamification
- advanced AI generation

## Required Data Model
Design relational tables with ownership + timestamps + FKs + indexes:
- users, profiles
- long_term_visions
- goals, goal_milestones, projects
- systems, routines_or_habits
- daily_entries, gratitude_entries, thought_entries
- brainstorm_items
- daily_croaks, daily_advice
- alignment_scores
- daily_reviews, weekly_reviews, monthly_reviews, quarterly_reviews
- insight_snapshots
- streaks_or_activity_summaries

## Business Logic (MVP)
- Vision hierarchy: legacy -> identity -> 5y -> 2y -> 90d -> month -> week -> day
- Alignment score: focus, discipline, courage, health, output, alignment, peace_of_mind (1-5 avg)
- Drift flags:
  - repeated unresolved issues
  - shifting priorities without progress
  - overplanning without action
  - abandoned goals
  - emotional loops
  - unfinished ideas accumulation

## Seeded Content
- 14 daily croaks
- 14 daily advice entries
- frameworks:
  - Thought -> Decision -> Action
  - Vision -> System -> Execution
  - Identity -> Habits -> Results
  - Capture -> Clarify -> Commit -> Review
  - Reflection -> Correction -> Progress

## Implementation Order (Strict)
### Phase 1
1. Inspect repo
2. Summarize architecture
3. Lock MVP scope
4. Define sitemap
5. Define DB schema
6. Define scoring logic
7. Define croak seed strategy
8. Define advice seed strategy
9. Define insights logic
10. Define reusable components

### Phase 2
11. Create/adapt folder structure
12. Add schema + types
13. Add seed data
14. Base layout + navigation
15. Onboarding
16. Dashboard
17. Daily entry flow
18. Goals & vision
19. System builder
20. Brainstorm vault
21. Reviews
22. Insights
23. Persistence
24. Empty/loading/error states
25. Mobile UX refinement

## Output Contract
At start output only:
1. Product Vision
2. MVP Scope
3. App Sitemap
4. Database Schema
5. Business Logic
6. Folder Structure
7. Build Order
8. Risks/Simplifications

Then implement immediately.

## Definition of Done
MVP is done when:
- onboarding saves profile + long-term goals
- dashboard loads seeded daily croak + daily advice
- daily entry can create/edit
- goals page edits time horizons
- system builder supports create/edit/list
- brainstorm vault supports create/filter/list
- reviews has daily/weekly/monthly/quarterly sections
- insights shows basic trends + drift flags
- key data persists
- mobile readability is strong
- empty/loading/error states exist for major flows
