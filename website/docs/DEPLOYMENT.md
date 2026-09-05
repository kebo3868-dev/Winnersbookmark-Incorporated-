# Deploying the Marketing Website

> **Nothing here has been done yet.** This is the runbook for when deployment is
> approved. The existing Restaurant Rescue Agent Vercel project is untouched by
> everything in this document.

## The critical rule

**Create a SECOND Vercel project. Do not change the existing one.**

The existing project is pinned to Root Directory `rescue-agent`. Changing it
would take the operator console offline. The two projects share a repository
and nothing else.

| | Existing project | New project |
|---|---|---|
| Root Directory | `rescue-agent` | `website` |
| Serves | Internal console (Basic Auth) | Public marketing site |
| Database | Neon Postgres | **None** |
| Intended domain | `app.winnersbookmark.com` | `winnersbookmark.com` |

---

## Step 1 — Generate the shared secret

Run this once, locally. It produces one value used in **both** projects:

```bash
openssl rand -base64 32
```

Keep it somewhere safe. If the two copies ever differ, every enquiry returns
401 — see "If the form stops working" below.

## Step 2 — Add variables to the EXISTING rescue-agent project

Vercel → the rescue-agent project → Settings → Environment Variables
(Production):

| Variable | Value |
|---|---|
| `MARKETING_INGEST_SECRET` | The value from step 1 |
| `MARKETING_LEAD_NOTIFY_EMAIL` | Where new enquiries are emailed |
| `MARKETING_LEAD_FROM_EMAIL` | A sending address on a domain verified with the email provider |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | From resend.com |

Then redeploy that project so the new `MarketingLead` migration is applied. The
migration is additive — `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, with no
`ALTER` and no `DROP` — and has been verified to apply from an empty database
with zero schema drift.

**Email is optional.** With `EMAIL_PROVIDER` unset, leads are still stored and
the API honestly reports `notification: "not_configured"`. It never claims to
have emailed anyone.

## Step 3 — Create the new Vercel project

1. Vercel → Add New → Project → import the **same** GitHub repository.
2. **Root Directory: `website`.** This is the setting that matters most.
3. Framework preset: Next.js (detected automatically).
4. Do **not** connect a database. This app does not need one.

Environment variables (Production):

| Variable | Value |
|---|---|
| `LEADS_INGEST_URL` | `https://<rescue-agent-domain>/api/marketing/leads` |
| `MARKETING_INGEST_SECRET` | The **same** value from step 1 |
| `NEXT_PUBLIC_SITE_URL` | Only once a custom domain is connected — otherwise leave unset |
| `NEXT_PUBLIC_BOOKING_URL` | Only if a real scheduler exists |
| `NEXT_PUBLIC_CONTACT_EMAIL` | The public contact address |

## Step 4 — Verify before announcing

1. Open the deployment. The homepage should load with no password prompt.
2. Visit `/robots.txt`. Before a custom domain it will read `Disallow: /` —
   correct, and it prevents the preview URL outranking the real site later.
3. Submit a **real test enquiry** through `/contact`.
4. Confirm it appears in the database, and that the notification email arrived
   if email is configured.
5. Only then connect the domain.

**If step 3 shows a failure message instead of "Enquiry received", the wiring is
wrong — do not announce the site.** That message means nothing was recorded,
which is the form behaving correctly, not the form working.

---

## Connecting the domain (later)

Only once the domain is genuinely registered and controlled:

1. Vercel → the website project → Settings → Domains → add `winnersbookmark.com`.
2. Follow Vercel's DNS instructions at the registrar.
3. Set `NEXT_PUBLIC_SITE_URL=https://winnersbookmark.com` and redeploy.
   Canonicals, Open Graph URLs, the sitemap and `robots.txt` all switch over —
   `robots.txt` starts allowing indexing at this point, not before.
4. Optionally point `app.winnersbookmark.com` at the rescue-agent project, and
   update `LEADS_INGEST_URL` to match if you do.

---

## If the form stops working

The most likely cause is that the two copies of `MARKETING_INGEST_SECRET` no
longer match — for example one was rotated and the other was not.

Symptoms and how to confirm:

- Visitors see "Your enquiry was not sent" with the email fallback. Nothing is
  lost silently.
- The rescue agent records a bounded rejection: category `FAILED_INTEGRATION`,
  operation `marketing.leads.ingest`, reason `BAD_INGEST_SECRET`, coalesced to
  one row per hour with an attempt counter.

Fix by setting both projects to the same value and redeploying both.
