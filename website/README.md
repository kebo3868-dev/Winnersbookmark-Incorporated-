# Winners Bookmark Incorporated — Marketing Website

The public website for Winners Bookmark Incorporated: an AI consulting and
automation company building specialised AI agents for restaurants and local
service businesses.

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS.

---

## Why this is a separate application

This repository holds three applications. They are separate deliberately.

| Directory | What it is | Deployed |
|---|---|---|
| `website/` | **This app.** Public marketing site. No credentials, no database. | Vercel project #2 |
| `rescue-agent/` | Internal operator console. Holds audit data and sales intelligence, behind HTTP Basic Auth. | Vercel project #1 |
| `/` (repo root) | Daily Blogs — a separate content business. Preserved, not deployed. | No |

**It could not live inside `rescue-agent`.** Everything served from that project
inherits its operator-wide Basic Auth, which a public marketing site cannot
have. Mixing a public surface into the app that holds confidential client data
would also widen exactly the boundary that app works hardest to keep narrow.

**It could not be the repo-root app.** That is a different business with a
different audience, and it is a client-rendered SPA — the weakest starting
point for the search visibility this site needs.

---

## Adding a new AI agent

This is the architecture's main job. Adding an agent is a **data edit**, not a
redesign.

1. Add an entry to the `agents` array in `src/data/agents.ts`.
2. That is the whole change.

The new agent automatically gets its own page (`/solutions/<slug>`), a card on
the homepage and solutions index, metadata and Open Graph tags, JSON-LD
structured data, a sitemap entry, and correct status badges everywhere it
appears.

### The honesty contract

`src/data/agents.ts` carries rules enforced by tests in
`tests/agent-registry.test.ts`. A change that breaks one **fails CI** rather
than shipping:

- A `COMING_SOON` agent cannot have `LIVE` features or claimed outcomes.
- Only `LIVE` or `PILOT` agents may be `featured`.
- No percentage or currency figures anywhere in the registry — the company has
  no published outcome data, so it publishes no numbers.
- `caseStudies` must stay empty until real, attributable, consented customer
  results exist.

These exist because overclaiming is the fastest way for a young company to
become untrustworthy, and copy drifts when nothing holds it in place.

---

## The contact form

Enquiries are **never** silently discarded.

```
browser → server action → rescue-agent /api/marketing/leads → MarketingLead row
                                                            → founder email
```

- The form posts through a **server action**, so the ingest secret stays on the
  server and the form still works if JavaScript fails to load.
- Success renders **only** on a confirmed `201`. Every other outcome shows a
  visible failure saying nothing was recorded, plus the direct email address.
- The site holds **no database credentials**. The rescue agent owns the leads
  schema; this app only posts to it.
- The honeypot **flags** suspected bots rather than blocking them — silently
  deleting a real customer enquiry is the more expensive error.

If `LEADS_INGEST_URL` and `MARKETING_INGEST_SECRET` are not set, the form
refuses loudly and shows the email fallback. It never pretends to have sent.

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in LEADS_INGEST_URL + MARKETING_INGEST_SECRET
npm run dev                  # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Registry integrity + honesty contract |

---

## Domain

**No custom domain is assumed anywhere in this codebase.** An audit found no
evidence the company controls `winnersbookmark.com`.

The canonical origin resolves in this order:

1. `NEXT_PUBLIC_SITE_URL` — set this when a domain is verified and connected.
2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's stable production alias.
3. `http://localhost:3000`.

When none resolves to a public origin, `robots.txt` disallows indexing, so an
unconfigured deployment cannot be indexed ahead of the real site.

The intended long-term structure is `winnersbookmark.com` for this site and
`app.winnersbookmark.com` for the rescue agent. Connecting it later is a Vercel
setting plus one environment variable — no code change.

---

## Design system

Three colours: black for depth, electric blue for action, white for clarity.
Tokens live in `tailwind.config.ts`; component classes in `src/app/globals.css`.

Blue is rationed — it marks the thing you should click and nothing else. There
is exactly one primary (solid blue) action per view. The palette deliberately
does **not** inherit the rescue agent's gold console theme or the Daily Blogs
gold/electric mix; those are separate products with separate audiences.
