# Winners Bookmark AI Front Desk — operations

Running the front desk for a real restaurant, and what must be true before you do.

---

## 1. The daily failure-queue review is not optional

**Every safety guarantee in this system ends at "and an operator sees it in the failure queue."**

The front desk is built so that nothing fails silently. When a manager's alert is blocked because they texted STOP, when a carrier rejects a number, when a critical alert reaches nobody at all — none of that is swallowed. It is written to the failure queue and shown on the restaurant's dashboard under **Needs attention**.

That design has one dependency, and it is a human being. A failure queue nobody reads is a database table. The guarantee is not "the system will tell someone"; it is "the system will record it where someone who looks will find it."

So a pilot requires a **named person** who does this **every day**:

1. Open each restaurant's dashboard.
2. Read **Staff alerts that reached nobody**. Every row is an escalation a human was supposed to hear about and did not. Contact them another way *first*, then fix the routing.
3. Read **Staff alerts with no delivery confirmation**. A backlog here almost always means the delivery-status callback is not wired up — which makes every alert look successful whether or not it arrived.
4. Read **Needs attention**. Work it to zero. An entry you cannot resolve is an entry that needs escalating to engineering, not one to leave for tomorrow.
5. Confirm the dispatch worker ran. `queueDepth` climbing across cycles means alerts are arriving faster than they leave.

**What "reviewed" means:** the queue is empty, or every remaining entry has a named owner and a next action. "I looked at it" is not a review.

**Escalation path:** any `escalation.critical_unreachable` entry — logged as `CRITICAL ALERT REACHED NOBODY` — is a same-day incident, not a queue item. It means a life-safety or food-safety report was routed to a person and no message could be delivered to anyone on the rota.

---

## 2. Pilot-readiness gate

`GET /api/frontdesk/{slug}/readiness` returns every check, its state, and **who can clear it**. `POST /api/frontdesk/{slug}/activate` re-runs all of them and **refuses** if any blocking check fails. A restaurant cannot be moved to ACTIVE by clicking past a warning.

The gate is re-evaluated at the moment of activation, not trusted from a dashboard someone read yesterday. A rota contact can opt out and a secret can be rotated between the two.

Activation is **platform-admin only**. A restaurant owner deciding their own front desk is ready is the conflict of interest the gate exists to remove.

---

## 3. What can be finished in code vs. what cannot

This separation matters because a checklist that mixes them gets ignored by both the engineer and the operator.

### Completable in this repository — **done**

| Item | Where |
|---|---|
| Production SMS provider adapter (Twilio) behind the existing interface | `src/lib/frontdesk/notify/twilio.ts` |
| Mock provider retained for tests, refused in production | `src/lib/frontdesk/notify/provider.ts` |
| Bounded retries, backoff, permanent-vs-transient classification | `src/lib/frontdesk/notify/retry.ts` |
| Atomic claim, duplicate-send protection, crash recovery | `src/lib/frontdesk/notify/store.ts` |
| Worker observability: duration, queue depth, batch saturation | `src/lib/frontdesk/notify/worker.ts` |
| Delivery-receipt handling for both the platform and Twilio schemes | `src/app/api/frontdesk/notifications/webhook/route.ts` |
| Secret declaration, strength checking, leak-proof reporting | `src/lib/frontdesk/config/secrets.ts` |
| Pilot-readiness gate and activation refusal | `src/lib/frontdesk/config/readiness.ts` |
| Escalation rota, ordered fallback, delivery-proven verification | `src/lib/frontdesk/notify/verification.ts` |
| Undelivered and stalled escalation surfacing | dashboard + `notify/store.ts` |
| Controlled one-message real-provider smoke test | `scripts/provider-smoke-test.mjs` |

### Requires an operator — **configuration and secrets, no code**

Set as environment variables. **Never commit any of these.** The repository has no `.env` file and none should be added; `buildSecretReport()` will tell you which are missing without printing any value.

| Variable | Why |
|---|---|
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | The app refuses every request with 503 in production until both are set |
| `FRONTDESK_CRON_SECRET` | Authenticates the dispatch trigger. Under 16 characters is rejected outright |
| `SMS_PROVIDER` | `twilio` for a pilot. `mock` sends nothing |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Vendor credentials |
| `TWILIO_STATUS_CALLBACK_URL` | Without it, alerts stop at SENT and delivery is unknowable |
| `FRONTDESK_DISPATCH_SCHEDULED` | Assert that a scheduler is actually running — see below |
| Per-tenant webhook secret | Generated per restaurant; the platform stores only its digest |

**The dispatch worker must be scheduled.** Either point a scheduler at the cron endpoint, or run `npm run worker:notifications` as a long-lived process. Without one, alerts are created and never sent — operationally identical to having no alerting at all. `FRONTDESK_DISPATCH_SCHEDULED=true` is an operator's assertion that this is done; the app cannot observe a scheduler from inside a request, which is why the readiness check for it is owned by a human.

### Requires the outside world — **cannot be done in code or by configuration**

| Item | Why the platform cannot do it |
|---|---|
| **A2P 10DLC brand + campaign registration** | A carrier process with a real business identity. Unregistered traffic is filtered or blocked, and no amount of correct code changes that |
| **Real provider credentials** | Requires an account someone opens and pays for |
| **A real sending phone number** | Must be purchased and provisioned. Demo numbers are in the 555-01xx fiction range and will fail at the carrier |
| **Restaurant-owner verification** | Only the owner can confirm that what the front desk will say about their business is true. No validation substitutes for this |
| **Staffed escalation contacts** | Real people who have agreed to be woken, with numbers that have been tested |
| **A named daily reviewer** | See section 1 |

---

## 4. Testing the escalation rota

`pilot.escalationRota` is the ordered list of contact keys a CRITICAL alert tries. Order matters: the first name is the person who gets woken.

`POST /api/frontdesk/{slug}/rota` with `{"contactKey":"manager"}` sends a test alert. It goes through the **same gated send path** as a real alert — consent, rate limits, configuration. A test that took a shortcut around those would prove nothing about the path the real alert uses.

A contact is only **VERIFIED** when a provider delivery receipt confirms the message arrived. An accepted send means the vendor took it, not that a phone rang. Changing a contact's number invalidates its verification, because the proof was about the old number.

---

## 5. Before the first real customer message

Run the smoke test once, against the real provider, to your own phone:

```
SMOKE_TEST_CONFIRM=i-understand-this-sends-a-real-sms \
  npm run smoke:provider -- --to +1... --from +1...
```

It sends exactly one message and refuses to run against the mock. It proves the credentials, the sending number and the carrier path — the one thing no unit test can.

Then confirm the delivery receipt arrived. **A message the provider accepted and never delivered looks identical to a successful one until you check.**
