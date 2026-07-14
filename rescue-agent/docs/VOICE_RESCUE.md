# Leverock's AI Call & Order Rescue System

> Product: **Winners Bookmark Restaurant Voice Rescue** — an overflow call
> recovery layer for restaurants.
> Owner: **Keith Warren**, Winners Bookmark Incorporated.

This module extends the Restaurant Rescue Agent with an AI voice receptionist
and call rescue system for **Leverock's Great Seafood**. It answers overflow
and missed calls, answers common questions, captures structured **draft** to-go
orders, escalates high-risk calls to staff, and captures large-party and
private-event leads — creating a clean record of previously invisible lost
revenue.

It is **not** a generic chatbot. It is a disciplined restaurant call operations
layer, and it does **not** replace employees — it protects them during rushes
and captures demand when they are unavailable.

## The one rule that governs everything: human-in-the-loop

Version one never sends a final order to the kitchen. The agent captures a
**draft order** — a *request for staff review*. The dashboard's Draft Order
Queue is where a human accepts, calls back, or rejects it. The agent is
instructed never to say an order is "confirmed"; it says it is *submitting the
order request for restaurant review*.

The same discipline applies to knowledge: the agent **never invents** a price,
hours, wait time, pickup time, or fresh-fish availability. Uncertain data is
escalated or offered for confirmation, never guessed.

## What is built (this repository)

| Layer | Location | Notes |
| --- | --- | --- |
| Data model | `prisma/schema.prisma` | `RestaurantProfile`, `BusinessHours`, `MenuCategory`, `MenuItem`, `RestaurantPolicy`, `Faq`, `StaffContact`, `VoiceCall`, `CallEvent`, `DraftOrder`, `DraftOrderItem`, `Lead`, `StaffAlert` + enums |
| Migration | `prisma/migrations/20260714000000_voice_rescue/` | Incremental; run with `npm run db:deploy` |
| Seed | `prisma/seed.ts` + `src/lib/voice/menuData.ts` | Leverock's menu, `PHOTO_OBSERVED`. `npm run db:seed` |
| Persona + config | `src/lib/voice/config.ts` | Agent persona, greeting, safe scripted lines, tool-auth |
| Intent + safety | `src/lib/voice/intents.ts` | Intent taxonomy, escalation matrix, deterministic safety gate |
| Order validation | `src/lib/voice/draftOrder.ts` | Validates captured items vs. verified menu; produces review flags |
| Voice tool APIs | `src/app/api/voice/*` | Provider-facing tools (bearer-token guarded) |
| Staff action API | `src/app/api/draft-orders/[id]` | Accept / call-back / reject (Basic-Auth guarded) |
| Dashboard | `src/app/voice-rescue/` | Metrics, live call feed, draft order queue |
| Tests | `tests/voice-*.test.ts` | 19 tests over the pure safety/validation logic |

### Voice tool endpoints (`/api/voice/*`)

Called by the external voice provider. Exempt from the app's Basic Auth; they
enforce their own `VOICE_TOOL_TOKEN` bearer guard and **fail closed in
production** if it is unset.

| Endpoint | Method | Voice tool |
| --- | --- | --- |
| `/api/voice/restaurant-info` | GET | `lookup_restaurant_information`, `lookup_business_hours` |
| `/api/voice/menu/search?q=` | GET | `search_menu` |
| `/api/voice/menu/item?slug=` | GET | `lookup_menu_item`, `get_menu_item_options` |
| `/api/voice/draft-orders` | POST | `create_draft_order` |
| `/api/voice/escalations` | POST | `log_escalation`, `send_staff_alert` |
| `/api/voice/leads` | POST | `capture_large_party_lead`, `capture_private_event_lead` |

Every write endpoint validates input with Zod, never trusts the agent's payload
blindly, and returns the exact line the agent should say next (e.g. the
allergy/emergency hand-off script, or the "submitted for review" line).

### Deterministic safety gate

`classifyEscalation()` runs on the caller's own words, independent of the LLM's
intent classification, so a misclassification can never suppress a safety
escalation:

- **Emergency** language → `EMERGENCY_ESCALATION`, and the agent is told to
  instruct the caller to dial 911.
- **Allergy / medical dietary** language → `MANAGER_ON_DUTY` (HIGH). The agent
  never guarantees allergen or cross-contamination safety.
- **Explicit human request** → `HOST_STAND`.
- Two failed clarification attempts → escalate rather than loop.

### Draft-order validation flags

`validateDraftOrder()` matches each captured item to verified menu data and
attaches flags that drive human review: `UNKNOWN_MENU_ITEM`, `ITEM_UNAVAILABLE`,
`INVALID_PREPARATION`, `INVALID_SIDE`, `INVALID_MODIFIER`,
`MISSING_REQUIRED_OPTION`, `PRICE_UNAVAILABLE`, `REQUIRES_STAFF_CONFIRMATION`,
`ALLERGY_ESCALATION`. Estimated value sums only *known* prices — it is labeled
**ESTIMATED**, never presented as a confirmed total.

## Knowledge confidence

Every knowledge record carries a `verificationStatus`
(`UNVERIFIED → PHOTO_OBSERVED → STAFF_CONFIRMED → MANAGER_CONFIRMED →
SYSTEM_CONFIRMED → ARCHIVED`). The seed data is **all `PHOTO_OBSERVED`** — the
menu came from photos and is **not production-ready**. The agent only quotes a
price or hours when the record is staff/manager/system confirmed; otherwise it
offers to confirm with the team. Raise records to confirmed before launch.

## Setup

```bash
cd rescue-agent
npm install
# set DATABASE_URL in .env
npm run db:deploy      # apply migrations (incl. voice rescue)
npm run db:seed        # load Leverock's menu (PHOTO_OBSERVED)
npm run dev            # http://localhost:3000/voice-rescue
```

Add `VOICE_TOOL_TOKEN` (≥16 chars) before exposing the voice endpoints.
Configure `StaffContact` phone numbers in the database — they are intentionally
seeded blank and inactive; **personal numbers are never hard-coded in source.**

## Wiring the telephony layer (needs credentials — not in this repo)

The system is provider-agnostic by design. To go live:

1. **Voice provider (preferred: Retell AI; modular for Vapi / Twilio Voice).**
   Create an agent, paste `AGENT_PERSONA` from `src/lib/voice/config.ts` as the
   prompt, and register the six `/api/voice/*` endpoints as custom tools with the
   `Authorization: Bearer $VOICE_TOOL_TOKEN` header.
2. **Telephony (Twilio).** Point the restaurant's overflow / after-hours number
   (or a test number) at the voice provider. Enable call-status callbacks so
   `VoiceCall` rows can be opened/closed and `CallEvent`s logged.
3. **Notifications.** `StaffAlert` rows are created `PENDING`. Wire an SMS/n8n/
   Make delivery worker to mark them `SENT`/`FAILED`; that worker is deployment-
   specific and is deliberately out of this repo.

Until those credentials are configured, the data model, validation, tool APIs,
staff dashboard, and safety logic are fully functional and testable on their
own — you can exercise the full loop by POSTing to the `/api/voice/*` endpoints.

---
Designed by Winnersbookmark Incorporated.
