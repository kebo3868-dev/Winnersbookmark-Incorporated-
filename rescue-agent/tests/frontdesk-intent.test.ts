import { describe, expect, it } from 'vitest';
import {
  detectIntent,
  extractDate,
  extractEmail,
  extractName,
  extractPartySize,
  extractPhone,
  extractTime,
} from '@/lib/frontdesk/intent';

describe('intent detection', () => {
  it.each([
    ['What time do you close tonight?', 'HOURS'],
    ['Are you open right now?', 'HOURS'],
    ['Where are you located?', 'LOCATION'],
    ['Is there parking nearby?', 'PARKING'],
    ['Can I see the menu?', 'MENU'],
    ['How much is the ribeye?', 'PRICING'],
    ['Do you have vegan options?', 'DIETARY'],
    ['I need a table for 4 on Friday', 'RESERVATION'],
    ['I need to cancel my reservation', 'RESERVATION_CHANGE'],
    ['Can I order takeout?', 'TAKEOUT'],
    ['Do you deliver to downtown?', 'DELIVERY'],
    ['I need catering for an office lunch', 'CATERING'],
    ['Do you have a private room for a rehearsal dinner?', 'PRIVATE_EVENT'],
    ['Do you sell gift cards?', 'GIFT_CARD'],
    ['Are you hiring servers?', 'EMPLOYMENT'],
    ['Is the dining room wheelchair accessible?', 'ACCESSIBILITY'],
    ['Any specials tonight?', 'SPECIALS'],
    ['I want to speak to a real person', 'HUMAN_ASSISTANCE'],
    ['Let me talk to the manager', 'MANAGER_REQUEST'],
  ])('classifies %j as %s', (message, expected) => {
    expect(detectIntent(message).intent).toBe(expected);
  });

  it('puts safety ahead of commerce when both appear in one message', () => {
    // The reservation is the commercial intent; the allergy is the one that
    // can hurt somebody, so it must win.
    const match = detectIntent('I want to book a table for my son who is allergic to peanuts');
    expect(match.intent).toBe('ALLERGY');
    expect(match.secondary).toContain('RESERVATION');
  });

  it('routes a complaint ahead of the reservation it mentions', () => {
    const match = detectIntent('Our reservation was terrible last night, the service was rude');
    expect(match.intent).toBe('COMPLAINT');
  });

  it('carries multiple intents from one message', () => {
    const match = detectIntent('What time do you close and do you have parking?');
    expect([match.intent, ...match.secondary]).toEqual(expect.arrayContaining(['HOURS', 'PARKING']));
  });

  it('returns UNKNOWN with zero confidence for unclassifiable text', () => {
    const match = detectIntent('asdkjhasd qwerty');
    expect(match.intent).toBe('UNKNOWN');
    expect(match.confidence).toBe(0);
  });

  it('does not classify empty input', () => {
    expect(detectIntent('   ').intent).toBe('UNKNOWN');
  });
});

describe('entity extraction', () => {
  it.each([
    ['a table for 6', 6],
    ['party of 12', 12],
    ['we have 22 people', 22],
    ['reservation for four', 4],
    ['I need to feed 40', 40],
    ['group of 8', 8],
  ])('reads party size from %j', (message, expected) => {
    expect(extractPartySize(message)).toBe(expected);
  });

  it('does not mistake a price or a year for a party size', () => {
    expect(extractPartySize('is the ribeye $52')).toBeNull();
    expect(extractPartySize('we came in 2019')).toBeNull();
  });

  it('reads phone numbers in the formats customers actually type', () => {
    expect(extractPhone('call me at 727-555-0142')).toBe('(727) 555-0142');
    expect(extractPhone('(727) 555-0142')).toBe('(727) 555-0142');
    expect(extractPhone('+1 727 555 0142')).toBe('(727) 555-0142');
    expect(extractPhone('7275550142')).toBe('(727) 555-0142');
  });

  it('ignores digit strings that are not phone numbers', () => {
    expect(extractPhone('table for 4 at 7pm')).toBeNull();
  });

  it('reads email addresses', () => {
    expect(extractEmail('reach me at dana@example.com please')).toBe('dana@example.com');
    expect(extractEmail('no email here')).toBeNull();
  });

  it.each([
    ['7pm', '19:00'],
    ['7:30 PM', '19:30'],
    ['at 11am', '11:00'],
    ['19:00', '19:00'],
    ['noon', '12:00'],
  ])('reads the time from %j', (message, expected) => {
    expect(extractTime(message)).toBe(expected);
  });

  it('only takes a name when the customer states one', () => {
    expect(extractName('My name is Dana')).toBe('Dana');
    expect(extractName("this is Marcus Reed")).toBe('Marcus Reed');
    expect(extractName('I would like a table')).toBeNull();
    // "I'm looking" must not become a customer called "Looking".
    expect(extractName("I'm looking for a reservation")).toBeNull();
  });
});

describe('date resolution', () => {
  // Wednesday 2026-08-12, 19:00 in New York.
  const now = new Date('2026-08-12T23:00:00Z');
  const tz = 'America/New_York';

  it('resolves tonight and tomorrow against the restaurant timezone', () => {
    expect(extractDate('tonight', now, tz).iso).toBe('2026-08-12');
    expect(extractDate('tomorrow', now, tz).iso).toBe('2026-08-13');
  });

  it('resolves a named weekday to the next occurrence', () => {
    expect(extractDate('on Friday', now, tz).iso).toBe('2026-08-14');
  });

  it('treats today’s own weekday name as next week', () => {
    // Said on a Wednesday, "Wednesday" means the coming one, not today.
    expect(extractDate('Wednesday', now, tz).iso).toBe('2026-08-19');
  });

  it('keeps a vague phrase as text rather than inventing a date', () => {
    const result = extractDate('sometime next month', now, tz);
    expect(result.iso).toBeNull();
    expect(result.text).toBe('next month');
  });

  it('returns nothing when no date was mentioned', () => {
    expect(extractDate('do you have parking', now, tz)).toEqual({ iso: null, text: null });
  });
});
