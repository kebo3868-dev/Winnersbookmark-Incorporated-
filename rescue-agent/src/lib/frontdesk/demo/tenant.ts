import type { TenantConfig } from '../config/schema';

/**
 * DEMO MODE (§XXI)
 *
 * A fictional restaurant, run through the real engine. Nothing here is a
 * shortcut or a scripted answer — the demo tenant is an ordinary tenant
 * config, so what a prospect sees in a demo is exactly what the engine does.
 *
 * Every value is deliberately unusable in the real world:
 *   - `.invalid` is reserved by RFC 2606 and can never resolve.
 *   - 555-01xx numbers are reserved for fiction (RFC 3849 convention).
 * A demo record that leaked into production data would still be inert.
 */

export const DEMO_TENANT_SLUG = 'demo-harbor-house';
export const DEMO_WEBSITE_URL = 'https://harbor-house-demo.invalid';

export const DEMO_TENANT_NAME = 'Harbor House Kitchen (DEMO)';

export const demoTenantConfig: TenantConfig = {
  version: 1,
  restaurantName: 'Harbor House Kitchen',
  websiteUrl: DEMO_WEBSITE_URL,
  mainPhone: '(555) 010-0100',
  locations: [
    {
      id: 'waterfront',
      name: 'Harbor House Kitchen — Waterfront',
      addressLine1: '18 Dockside Way',
      city: 'St. Petersburg',
      state: 'FL',
      postalCode: '33701',
      timezone: 'America/New_York',
      phone: '(555) 010-0100',
      hours: {
        sun: [{ open: '10:00', close: '21:00', label: 'Brunch and dinner' }],
        mon: [],
        tue: [{ open: '11:30', close: '22:00' }],
        wed: [{ open: '11:30', close: '22:00' }],
        thu: [{ open: '11:30', close: '22:00' }],
        fri: [{ open: '11:30', close: '23:00' }],
        sat: [{ open: '10:00', close: '23:00' }],
      },
      holidayHours: [
        { date: '2026-12-25', name: 'Christmas Day', closed: true, windows: [], note: 'We reopen on the 26th at 11:30 AM.' },
        { date: '2026-11-26', name: 'Thanksgiving', closed: false, windows: [{ open: '12:00', close: '18:00' }] },
      ],
      directionsNote: "We're on the water at the end of Dockside Way, next to the marina.",
      parkingNote: 'Free parking in the marina lot next door, and valet on Friday and Saturday evenings.',
      accessibilityNote: 'The dining room and restrooms are step-free and wheelchair accessible, and service animals are welcome.',
      mapUrl: 'https://maps.example.invalid/harbor-house',
    },
  ],
  menu: {
    url: 'https://harbor-house-demo.invalid/menu',
    summary: 'We serve Gulf Coast seafood, dry-aged steaks and a raw bar.',
    highlights: ['the grouper sandwich', 'dry-aged ribeye', 'the raw bar'],
    dietaryOptions: ['vegetarian dishes', 'a gluten-free menu', 'vegan entrées on request'],
    pricingNote: 'Entrées run about $24 to $52, and the raw bar is priced by the piece.',
  },
  reservations: {
    enabled: true,
    url: 'https://book.harbor-house-demo.invalid',
    provider: 'demo-booking',
    note: undefined,
    phone: '(555) 010-0100',
  },
  takeout: { enabled: true, url: 'https://order.harbor-house-demo.invalid', phone: '(555) 010-0100' },
  delivery: { enabled: false },
  catering: { enabled: true, phone: '(555) 010-0130', note: 'Our catering team handles everything from office lunches to full-service events.' },
  privateEvents: { enabled: true, phone: '(555) 010-0140' },
  giftCards: { enabled: true, url: 'https://harbor-house-demo.invalid/gift-cards' },
  employment: { enabled: true, url: 'https://harbor-house-demo.invalid/careers' },
  reviewLink: 'https://review.harbor-house-demo.invalid',
  faqs: [
    {
      id: 'dress-code',
      keywords: ['dress code', 'dress', 'attire', 'shorts', 'jacket'],
      question: 'Is there a dress code?',
      answer: "We're smart casual — no jacket required, though most guests dress up a little for dinner on the water.",
    },
    {
      id: 'dogs',
      keywords: ['dog', 'dogs', 'pet', 'pets', 'patio dog'],
      question: 'Are dogs allowed?',
      answer: 'Well-behaved dogs are welcome on the patio, and we keep water bowls at the host stand.',
    },
    {
      id: 'kids',
      keywords: ['kids', 'children', 'child', 'family', 'high chair', 'kids menu'],
      question: 'Are you family friendly?',
      answer: "Absolutely — we have a children's menu, high chairs and booster seats.",
    },
    {
      id: 'walk-in',
      keywords: ['walk in', 'walk-in', 'waitlist', 'wait time', 'without a reservation'],
      question: 'Do you take walk-ins?',
      answer: 'We keep the bar and about a third of the dining room open for walk-ins, though weekend evenings usually have a wait.',
    },
  ],
  escalationContacts: [
    { key: 'manager', name: 'Dana Whitfield (DEMO)', phone: '(555) 010-0111', email: 'manager@harbor-house-demo.invalid' },
    { key: 'catering', name: 'Marcus Reed (DEMO)', phone: '(555) 010-0130', email: 'catering@harbor-house-demo.invalid' },
    { key: 'events', name: 'Priya Anand (DEMO)', phone: '(555) 010-0140', email: 'events@harbor-house-demo.invalid' },
    { key: 'urgent', name: 'General Manager on duty (DEMO)', phone: '(555) 010-0199' },
  ],
  escalationRouting: { CATERING: 'catering', PRIVATE_EVENT: 'events', FOOD_SAFETY: 'urgent' },
  brandVoice: {
    restaurantDisplayName: 'Harbor House',
    greeting: 'Thanks for reaching out to Harbor House Kitchen.',
    signOff: 'We look forward to seeing you.',
    tone: 'WARM_PROFESSIONAL',
    avoidPhrases: ['guys'],
  },
  promotions: [],
  thresholds: {
    largePartySize: 8,
    highPriorityPartySize: 12,
    averageCheckCents: 6_800,
    cateringMinimumCents: 75_000,
    privateEventMinimumCents: 250_000,
  },
  policies: {
    allowAllergenFreeClaims: false,
    reservationPolicy: 'Reservations are held for 15 minutes past the booking time.',
    cancellationPolicy: 'Please give us 24 hours notice for parties of 8 or more.',
    largePartyPolicy: 'Parties of 8 or more are confirmed by a manager and carry a 20% service charge.',
    restrictedTopics: [],
    approvedStatements: [],
  },
  messaging: {
    smsEnabled: false,
    missedCallRecoveryEnabled: false,
    maxFollowUps: 1,
    optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'],
  },
  retentionDays: 365,
};

/**
 * A second demo tenant with deliberately different thresholds and a thinner
 * configuration. It exists so tenant isolation and per-tenant behaviour can be
 * demonstrated (and tested) rather than merely asserted — the same sentence
 * gets a different answer at each restaurant.
 */
export const DEMO_TENANT_B_SLUG = 'demo-corner-cafe';

export const demoTenantBConfig: TenantConfig = {
  version: 1,
  restaurantName: 'The Corner Café',
  mainPhone: '(555) 010-0200',
  locations: [
    {
      id: 'main',
      name: 'The Corner Café',
      addressLine1: '402 Fifth Street North',
      city: 'St. Petersburg',
      state: 'FL',
      timezone: 'America/New_York',
      hours: {
        sun: [{ open: '08:00', close: '14:00' }],
        mon: [{ open: '07:00', close: '15:00' }],
        tue: [{ open: '07:00', close: '15:00' }],
        wed: [{ open: '07:00', close: '15:00' }],
        thu: [{ open: '07:00', close: '15:00' }],
        fri: [{ open: '07:00', close: '15:00' }],
        sat: [{ open: '08:00', close: '14:00' }],
      },
      holidayHours: [],
    },
  ],
  menu: { url: undefined, summary: 'Breakfast, sandwiches and coffee.', highlights: [], dietaryOptions: [] },
  // A 30-seat café treats a 6-top as a large party — the same enquiry that is
  // routine at Harbor House is a high-priority lead here.
  reservations: { enabled: false },
  takeout: { enabled: true, phone: '(555) 010-0200' },
  delivery: { enabled: false },
  catering: { enabled: false },
  privateEvents: { enabled: false },
  giftCards: { enabled: false },
  employment: { enabled: false },
  faqs: [],
  escalationContacts: [{ key: 'manager', name: 'Sam Okafor (DEMO)', phone: '(555) 010-0211' }],
  escalationRouting: {},
  brandVoice: { tone: 'CASUAL_FRIENDLY', avoidPhrases: [] },
  promotions: [],
  thresholds: { largePartySize: 6, highPriorityPartySize: 8, averageCheckCents: 1_600 },
  policies: { allowAllergenFreeClaims: false, restrictedTopics: [], approvedStatements: [] },
  messaging: {
    smsEnabled: false,
    missedCallRecoveryEnabled: false,
    maxFollowUps: 1,
    optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'],
  },
};
