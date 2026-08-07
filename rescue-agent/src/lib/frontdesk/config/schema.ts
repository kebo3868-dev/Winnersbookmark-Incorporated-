import { z } from 'zod';

/**
 * LAYER 2 — CLIENT CONFIGURATION
 *
 * Everything the front desk knows about a specific restaurant lives here and
 * only here. The engine reads this structure; it never contains a hard-coded
 * restaurant fact. Onboarding restaurant #50 means writing one of these
 * objects, not touching the engine.
 *
 * Design rules baked into this schema:
 *
 * 1. Almost every field is OPTIONAL. A missing field is not a bug — it is the
 *    signal that the front desk must NOT answer that kind of question and
 *    should defer to a human instead (§IV, §XXIX). Requiring fields here would
 *    push operators to invent placeholder data, which is exactly the failure
 *    mode this product must avoid.
 * 2. Nothing in here is a secret. Integration credentials are referenced by
 *    environment-variable NAME only (`credentialRef`), never by value (§XX).
 * 3. `approvedStatements` / `restrictedTopics` let a restaurant explicitly
 *    grant or forbid claims the engine would otherwise refuse to make.
 */

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');

/** One open period. A day may have several (lunch and dinner service). */
export const serviceWindowSchema = z.object({
  open: timeOfDay,
  close: timeOfDay,
  /** Optional label, e.g. "Lunch", "Brunch", "Bar only". */
  label: z.string().optional(),
});

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** A day with an empty array is explicitly CLOSED — distinct from "unknown". */
export const weeklyHoursSchema = z.object({
  sun: z.array(serviceWindowSchema),
  mon: z.array(serviceWindowSchema),
  tue: z.array(serviceWindowSchema),
  wed: z.array(serviceWindowSchema),
  thu: z.array(serviceWindowSchema),
  fri: z.array(serviceWindowSchema),
  sat: z.array(serviceWindowSchema),
});

export const holidayHoursSchema = z.object({
  /** ISO calendar date in the location's own timezone. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  name: z.string().optional(),
  closed: z.boolean().default(false),
  windows: z.array(serviceWindowSchema).default([]),
  note: z.string().optional(),
});

/**
 * A timezone this runtime can actually resolve.
 *
 * Every hours answer and every dashboard window passes this string straight to
 * `Intl.DateTimeFormat`, which throws `RangeError` on an unknown zone. Without
 * this check a routine typo ("America/New_Yrok") parses fine, the tenant looks
 * healthy, and then every single message and dashboard request fails at
 * runtime. Catching it here turns a hard outage into a visible misconfiguration.
 */
const ianaTimezone = z.string().min(1).refine(
  (value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Not a recognised IANA timezone (for example "America/New_York")' },
);

export const locationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().optional(),
  /** IANA timezone, e.g. "America/New_York". Drives every hours answer. */
  timezone: ianaTimezone,
  phone: z.string().optional(),
  hours: weeklyHoursSchema.optional(),
  holidayHours: z.array(holidayHoursSchema).default([]),
  directionsNote: z.string().optional(),
  parkingNote: z.string().optional(),
  accessibilityNote: z.string().optional(),
  mapUrl: z.string().url().optional(),
});

/** A pathway is a verified place to send a customer. Never invented. */
export const pathwaySchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().url().optional(),
  phone: z.string().optional(),
  /** Shown verbatim when present — lets the restaurant control the wording. */
  note: z.string().optional(),
  /** Provider name for adapter routing later (e.g. "opentable", "toast"). */
  provider: z.string().optional(),
});

export const faqSchema = z.object({
  id: z.string().min(1),
  /** Matching terms. Kept explicit so operators control retrieval, not a model. */
  keywords: z.array(z.string().min(1)).min(1),
  question: z.string().min(1),
  /** Sent to customers close to verbatim. This is approved copy. */
  answer: z.string().min(1),
});

export const escalationContactSchema = z.object({
  /** Routing key used by escalation rules, e.g. "manager", "catering". */
  key: z.string().min(1),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  /** Never disclosed to customers — internal routing only. */
  notes: z.string().optional(),
});

export const brandVoiceSchema = z.object({
  restaurantDisplayName: z.string().optional(),
  greeting: z.string().optional(),
  signOff: z.string().optional(),
  tone: z.enum(['WARM_PROFESSIONAL', 'UPSCALE_FORMAL', 'CASUAL_FRIENDLY']).default('WARM_PROFESSIONAL'),
  /** Phrases the restaurant does not want used. */
  avoidPhrases: z.array(z.string()).default([]),
});

export const promotionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  details: z.string().min(1),
  /** Outside this window the promotion is never mentioned. */
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Thresholds that make high-value routing configurable per restaurant (§IX).
 * A 12-top is routine for a banquet hall and a major event for a 30-seat cafe.
 */
export const thresholdsSchema = z.object({
  largePartySize: z.number().int().min(2).default(8),
  /** Party size at or above which a reservation is treated as high priority. */
  highPriorityPartySize: z.number().int().min(2).default(12),
  /** Used only for ESTIMATED opportunity value. Never reported as revenue. */
  averageCheckCents: z.number().int().min(0).optional(),
  cateringMinimumCents: z.number().int().min(0).optional(),
  privateEventMinimumCents: z.number().int().min(0).optional(),
});

/**
 * Explicit permissions. The engine's default is to refuse; these are how a
 * restaurant grants a specific claim it has verified itself (§XII).
 */
export const policySchema = z.object({
  /**
   * Verbatim allergen statement the restaurant has approved. Absent this, the
   * engine never makes an allergen claim of any kind.
   */
  approvedAllergenStatement: z.string().optional(),
  /** When true the engine may state a dish is free of a listed allergen. */
  allowAllergenFreeClaims: z.boolean().default(false),
  reservationPolicy: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  largePartyPolicy: z.string().optional(),
  dressCode: z.string().optional(),
  petPolicy: z.string().optional(),
  /** Topics the front desk must decline and route to a human. */
  restrictedTopics: z.array(z.string()).default([]),
  /** Free-form approved statements the engine may quote verbatim. */
  approvedStatements: z.array(z.object({ id: z.string(), text: z.string() })).default([]),
});

export const messagingSchema = z.object({
  smsEnabled: z.boolean().default(false),
  missedCallRecoveryEnabled: z.boolean().default(false),
  /** Env-var NAME holding the credential. Never the credential itself. */
  credentialRef: z.string().optional(),
  fromNumber: z.string().optional(),
  /** Hard cap on unanswered outbound follow-ups (§VII). */
  maxFollowUps: z.number().int().min(0).max(3).default(1),
  optOutKeywords: z.array(z.string()).default(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']),
});

export const tenantConfigSchema = z.object({
  /** Schema version so stored configs can be migrated safely. */
  version: z.literal(1).default(1),
  restaurantName: z.string().min(1),
  websiteUrl: z.string().url().optional(),
  mainPhone: z.string().optional(),
  locations: z.array(locationSchema).default([]),

  menu: z
    .object({
      url: z.string().url().optional(),
      /** Short verified description; never a substitute for the real menu. */
      summary: z.string().optional(),
      /** Verified highlights the engine may mention by name. */
      highlights: z.array(z.string()).default([]),
      /** Verified dietary accommodations, e.g. "vegetarian", "gluten-free menu". */
      dietaryOptions: z.array(z.string()).default([]),
      pricingNote: z.string().optional(),
    })
    .default({ highlights: [], dietaryOptions: [] }),

  reservations: pathwaySchema.default({ enabled: false }),
  takeout: pathwaySchema.default({ enabled: false }),
  delivery: pathwaySchema.default({ enabled: false }),
  catering: pathwaySchema.default({ enabled: false }),
  privateEvents: pathwaySchema.default({ enabled: false }),
  giftCards: pathwaySchema.default({ enabled: false }),
  employment: pathwaySchema.default({ enabled: false }),
  reviewLink: z.string().url().optional(),

  faqs: z.array(faqSchema).default([]),
  escalationContacts: z.array(escalationContactSchema).default([]),
  /** intent/reason → escalation contact key. Falls back to "manager". */
  escalationRouting: z.record(z.string()).default({}),
  brandVoice: brandVoiceSchema.default({ tone: 'WARM_PROFESSIONAL', avoidPhrases: [] }),
  promotions: z.array(promotionSchema).default([]),
  thresholds: thresholdsSchema.default({ largePartySize: 8, highPriorityPartySize: 12 }),
  policies: policySchema.default({
    allowAllergenFreeClaims: false,
    restrictedTopics: [],
    approvedStatements: [],
  }),
  messaging: messagingSchema.default({
    smsEnabled: false,
    missedCallRecoveryEnabled: false,
    maxFollowUps: 1,
    optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'],
  }),
  /** Per-tenant retention override; deployment default applies when unset. */
  retentionDays: z.number().int().min(1).max(3650).optional(),
});

export type TenantConfig = z.infer<typeof tenantConfigSchema>;
export type Location = z.infer<typeof locationSchema>;
export type ServiceWindow = z.infer<typeof serviceWindowSchema>;
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;
export type Pathway = z.infer<typeof pathwaySchema>;
export type Faq = z.infer<typeof faqSchema>;
export type EscalationContact = z.infer<typeof escalationContactSchema>;
export type Thresholds = z.infer<typeof thresholdsSchema>;

/**
 * Parse an untrusted stored config. Returns a typed result rather than
 * throwing so a single malformed tenant cannot take down a dashboard that
 * lists many tenants.
 */
export function parseTenantConfig(
  value: unknown,
): { ok: true; config: TenantConfig } | { ok: false; error: string } {
  const result = tenantConfigSchema.safeParse(value);
  if (result.success) return { ok: true, config: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: `${first.path.join('.') || 'config'}: ${first.message}` };
}
