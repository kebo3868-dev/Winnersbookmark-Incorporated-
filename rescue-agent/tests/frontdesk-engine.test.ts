import { describe, expect, it } from 'vitest';
import type { TenantConfig } from '@/lib/frontdesk/config/schema';
import { demoTenantBConfig, demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import { runTurn, type ConversationTurn } from '@/lib/frontdesk/engine';

/**
 * Conversation behaviour (§II–§VI, §VIII, §IX).
 *
 * The through-line of these tests: the front desk answers when it has verified
 * data, asks one question at a time when it needs more, defers honestly when
 * the configuration is silent, and never says a booking exists.
 */

const config = demoTenantConfig;
const now = new Date('2026-08-12T23:00:00Z'); // Wednesday 19:00 America/New_York

function ask(message: string, history: ConversationTurn[] = [], tenant: TenantConfig = config) {
  return runTurn({ config: tenant, message, history, now });
}

/** Walk a multi-turn conversation, feeding each reply back as history. */
function converse(messages: string[], tenant: TenantConfig = config) {
  const history: ConversationTurn[] = [];
  let last = runTurn({ config: tenant, message: messages[0], history, now });
  for (const message of messages.slice(1)) {
    history.push({ role: 'CUSTOMER', body: messages[messages.indexOf(message) - 1] ?? '' });
    history.push({ role: 'ASSISTANT', body: last.reply });
    last = runTurn({ config: tenant, message, history: buildHistory(messages, message, last), now });
  }
  return last;
}

function buildHistory(messages: string[], upTo: string, _last: unknown): ConversationTurn[] {
  const index = messages.indexOf(upTo);
  return messages.slice(0, index).map((body) => ({ role: 'CUSTOMER' as const, body }));
}

describe('answering from verified configuration', () => {
  it('answers the closing-time question directly, without a preamble', () => {
    const turn = ask('What time do you close tonight?');
    expect(turn.intent).toBe('HOURS');
    expect(turn.answerSource).toBe('VERIFIED_CONFIG');
    expect(turn.reply).toContain('10 PM');
    // The spec's "bad" example opens by reciting the concept. This must not.
    expect(turn.reply).not.toMatch(/^thank you for contacting/i);
    expect(turn.reply.length).toBeLessThan(200);
  });

  it('offers one useful next step after an hours answer', () => {
    expect(ask('What time do you close tonight?').reply).toMatch(/reservation/i);
  });

  it('answers parking from the location note', () => {
    const turn = ask('Is there parking?');
    expect(turn.answerSource).toBe('VERIFIED_CONFIG');
    expect(turn.reply).toContain('marina lot');
  });

  it('answers accessibility from the configured note', () => {
    expect(ask('Is it wheelchair accessible?').reply).toMatch(/step-free|accessible/i);
  });

  it('answers an approved FAQ verbatim', () => {
    const turn = ask('Is there a dress code?');
    expect(turn.answerSource).toBe('VERIFIED_FAQ');
    expect(turn.reply).toBe(config.faqs[0].answer);
  });

  it('sends ordering to the verified pathway rather than taking the order', () => {
    const turn = ask('Can I order takeout?');
    expect(turn.answerSource).toBe('VERIFIED_PATHWAY');
    expect(turn.reply).toContain('order.harbor-house-demo.invalid');
  });
});

describe('honest deferral when configuration is silent', () => {
  it('declines rather than inventing a delivery answer', () => {
    // Delivery is disabled for this restaurant.
    const turn = ask('Do you deliver to the beach?');
    expect(turn.answerSource).not.toBe('VERIFIED_CONFIG');
    expect(turn.reply).not.toMatch(/yes,? we deliver/i);
  });

  it('does not invent a price when no pricing note or menu exists', () => {
    const noMenu: TenantConfig = {
      ...config,
      menu: { url: undefined, summary: undefined, highlights: [], dietaryOptions: [], pricingNote: undefined },
    };
    const turn = ask('How much is the ribeye?', [], noMenu);
    expect(turn.answerSource).toBe('UNVERIFIED_DEFERRED');
    expect(turn.reply).toMatch(/don't want to give you incorrect information/i);
    expect(turn.reply).not.toMatch(/\$\d/);
  });

  it('does not repeat the weekly schedule on an unconfigured holiday', () => {
    const noHours: TenantConfig = {
      ...config,
      locations: [{ ...config.locations[0], hours: undefined, holidayHours: [] }],
    };
    const turn = ask('What time do you close tonight?', [], noHours);
    expect(turn.answerSource).toBe('UNVERIFIED_DEFERRED');
    expect(turn.reply).not.toMatch(/10 PM|22:00/);
  });

  it('captures a lead when it has to defer, so the enquiry is not lost', () => {
    const noMenu: TenantConfig = {
      ...config,
      menu: { url: undefined, summary: undefined, highlights: [], dietaryOptions: [], pricingNote: undefined },
    };
    const turn = ask('How much is the ribeye?', [], noMenu);
    expect(turn.actions.some((a) => a.type === 'CAPTURE_LEAD')).toBe(true);
  });

  it('only mentions a promotion inside its configured window', () => {
    const expired: TenantConfig = {
      ...config,
      promotions: [{ id: 'p1', title: 'Summer prix fixe', details: '3 courses for $45', endsOn: '2026-07-31' }],
    };
    const turn = ask('Any specials tonight?', [], expired);
    expect(turn.reply).not.toContain('prix fixe');
  });

  it('states an active promotion', () => {
    const active: TenantConfig = {
      ...config,
      promotions: [{ id: 'p1', title: 'Oyster hour', details: '$1 oysters 4-6 PM', startsOn: '2026-08-01', endsOn: '2026-09-30' }],
    };
    expect(ask('Any specials tonight?', [], active).reply).toContain('Oyster hour');
  });
});

describe('reservations: one question at a time', () => {
  it('asks a single question when details are missing', () => {
    const turn = ask('I would like to book a table');
    expect(turn.answerSource).toBe('CLARIFYING');
    // Exactly one question mark — not a form dumped on the customer.
    expect((turn.reply.match(/\?/g) ?? []).length).toBe(1);
  });

  it('asks for the next missing detail rather than repeating itself', () => {
    const first = ask('I would like to book a table for 4');
    expect(first.reply).toMatch(/date/i);

    const second = ask('Friday', [{ role: 'CUSTOMER', body: 'I would like to book a table for 4' }]);
    expect(second.reply).toMatch(/time/i);
  });

  it('accumulates details across turns', () => {
    const history: ConversationTurn[] = [
      { role: 'CUSTOMER', body: 'I want a table for 4' },
      { role: 'ASSISTANT', body: 'What date did you have in mind?' },
      { role: 'CUSTOMER', body: 'Friday at 7pm' },
      { role: 'ASSISTANT', body: 'Can I get a name for the booking?' },
    ];
    const turn = ask('Dana, 727-555-0142', history);
    expect(turn.slots.partySize).toBe(4);
    expect(turn.slots.requestedDate).toBe('2026-08-14');
    expect(turn.slots.requestedTime).toBe('19:00');
    expect(turn.slots.phone).toBe('(727) 555-0142');
  });

  it('captures the reservation as REQUESTED, never CONFIRMED', () => {
    const turn = ask('Table for 4 on Friday at 7pm, my name is Dana, 727-555-0142');
    expect(turn.bookingState).toBe('REQUESTED');
    expect(turn.reply).toMatch(/requested rather than confirmed|will confirm/i);
    // The reply must never assert the booking exists.
    expect(turn.reply).not.toMatch(/\byou'?re (booked|confirmed)\b|\btable is (booked|confirmed|held|reserved)\b/i);
  });

  it('creates a reservation lead with the details it collected', () => {
    const turn = ask('Table for 4 on Friday at 7pm, my name is Dana, 727-555-0142');
    const action = turn.actions.find((a) => a.type === 'CAPTURE_LEAD');
    expect(action?.type).toBe('CAPTURE_LEAD');
    if (action?.type === 'CAPTURE_LEAD') {
      expect(action.lead.category).toBe('RESERVATION');
      expect(action.lead.partySize).toBe(4);
      expect(action.lead.phone).toBe('(727) 555-0142');
      expect(action.lead.customerName).toBe('Dana');
      // 4 covers × $68 average check.
      expect(action.lead.estimatedValueCents).toBe(27_200);
    }
  });

  it('routes a reservation change to staff instead of pretending to edit it', () => {
    const turn = ask('I need to change my reservation for tomorrow');
    expect(turn.needsHuman).toBe(true);
    expect(turn.bookingState).toBe('REQUESTED');
  });
});

describe('high-value detection is per restaurant', () => {
  it('treats a 12-top as a high-priority large party at the full-service restaurant', () => {
    const turn = ask('Table for 12 on Friday at 7pm, my name is Dana, 727-555-0142');
    const action = turn.actions.find((a) => a.type === 'CAPTURE_LEAD');
    if (action?.type === 'CAPTURE_LEAD') {
      expect(action.lead.category).toBe('LARGE_PARTY');
      expect(action.lead.priority).toBe('URGENT');
    }
    expect(turn.actions.some((a) => a.type === 'ESCALATE')).toBe(true);
  });

  it('treats a 6-top as a large party at the café, where the threshold is lower', () => {
    // Same size booking, different restaurant, different answer — this is the
    // configurability the platform is built around (§IX).
    const turn = ask('Table for 6 on Friday at 9am, my name is Dana, 727-555-0142', [], demoTenantBConfig);
    const action = turn.actions.find((a) => a.type === 'CAPTURE_LEAD');
    expect(action?.type === 'CAPTURE_LEAD' && action.lead.category).toBe('LARGE_PARTY');
  });

  it('does not treat a 6-top as a large party at the full-service restaurant', () => {
    const turn = ask('Table for 6 on Friday at 7pm, my name is Dana, 727-555-0142');
    const action = turn.actions.find((a) => a.type === 'CAPTURE_LEAD');
    expect(action?.type === 'CAPTURE_LEAD' && action.lead.category).toBe('RESERVATION');
  });

  it('escalates catering to the configured catering contact', () => {
    const turn = ask('I need catering for 40 people on Friday, my name is Dana, 727-555-0142');
    const action = turn.actions.find((a) => a.type === 'CAPTURE_LEAD');
    expect(action?.type === 'CAPTURE_LEAD' && action.lead.category).toBe('CATERING');
    expect(action?.type === 'CAPTURE_LEAD' && action.lead.priority).toBe('URGENT');

    const escalation = turn.actions.find((a) => a.type === 'ESCALATE');
    expect(escalation?.type === 'ESCALATE' && escalation.escalation.routeTo).toBe('catering');
  });

  it('escalates a private event to the events contact', () => {
    const turn = ask('We want the private room for a rehearsal dinner on Friday for 30, Dana, 727-555-0142');
    const escalation = turn.actions.find((a) => a.type === 'ESCALATE');
    expect(escalation?.type === 'ESCALATE' && escalation.escalation.routeTo).toBe('events');
  });

  it('never promises the catering booking is secured', () => {
    const turn = ask('I need catering for 40 people on Friday, my name is Dana, 727-555-0142');
    expect(turn.reply).toMatch(/nothing is booked yet/i);
  });
});

describe('estimated value', () => {
  it('uses the configured catering minimum', () => {
    const turn = ask('I need catering for 40 people on Friday, my name is Dana, 727-555-0142');
    const action = turn.actions.find((a) => a.type === 'CAPTURE_LEAD');
    expect(action?.type === 'CAPTURE_LEAD' && action.lead.estimatedValueCents).toBe(75_000);
  });

  it('returns no estimate when the restaurant has not supplied an average check', () => {
    const noCheck: TenantConfig = {
      ...config,
      thresholds: { largePartySize: 8, highPriorityPartySize: 12 },
    };
    const turn = ask('Table for 4 on Friday at 7pm, my name is Dana, 727-555-0142', [], noCheck);
    const action = turn.actions.find((a) => a.type === 'CAPTURE_LEAD');
    // Null, not a guess. A fabricated figure would corrupt every report built
    // on top of it.
    expect(action?.type === 'CAPTURE_LEAD' && action.lead.estimatedValueCents).toBeNull();
  });
});

describe('unclear input', () => {
  it('asks a short clarifying question rather than guessing', () => {
    const turn = ask('hi');
    expect(turn.answerSource).toBe('CLARIFYING');
    expect(turn.reply).toMatch(/what would you like to know/i);
  });

  it('defers a long unclassifiable question to staff', () => {
    const turn = ask('Do you know if the marina next door rents out paddleboards on weekends?');
    expect(['UNVERIFIED_DEFERRED', 'CLARIFYING']).toContain(turn.answerSource);
    expect(turn.reply).not.toMatch(/yes|no,/i);
  });
});

describe('multi-location handling', () => {
  it('lists every location when more than one exists', () => {
    const twoSites: TenantConfig = {
      ...config,
      locations: [
        config.locations[0],
        { ...config.locations[0], id: 'uptown', name: 'Harbor House — Uptown', city: 'Tampa', addressLine1: '9 Main St' },
      ],
    };
    const turn = ask('Where are you located?', [], twoSites);
    expect(turn.reply).toContain('Tampa');
    expect(turn.reply).toContain('St. Petersburg');
  });

  it('answers hours for the location the customer named', () => {
    const twoSites: TenantConfig = {
      ...config,
      locations: [
        config.locations[0],
        {
          ...config.locations[0],
          id: 'uptown',
          name: 'Harbor House — Uptown',
          city: 'Tampa',
          hours: { ...config.locations[0].hours!, wed: [{ open: '11:30', close: '20:00' }] },
        },
      ],
    };
    const turn = ask('What time does the Tampa location close?', [], twoSites);
    expect(turn.reply).toContain('8 PM');
  });
});

describe('conversation continuity', () => {
  it('handles several intents across one conversation', () => {
    const result = converse([
      'What time do you close tonight?',
      'Do you have parking?',
      'Great, can I book a table for 4 on Friday at 7pm? My name is Dana, 727-555-0142',
    ]);
    expect(result.bookingState).toBe('REQUESTED');
    expect(result.actions.some((a) => a.type === 'CAPTURE_LEAD')).toBe(true);
  });
});

/**
 * REGRESSIONS FROM THE FIRST LIVE RUN
 *
 * Every case below was found by driving real conversations through the running
 * API, not by unit testing. They are pinned here because each one was invisible
 * to single-turn tests and each one broke the product in an obvious way.
 */
describe('regressions found by running the app', () => {
  it('reads a spelled-out answer to "how many people?"', () => {
    // "four of us" was not extracted, so the engine asked the same question on
    // every subsequent turn and the reservation could never complete.
    const turn = ask('four of us', [{ role: 'CUSTOMER', body: 'I would like to book a table' }]);
    expect(turn.slots.partySize).toBe(4);
    expect(turn.reply).toMatch(/date/i);
  });

  it('completes a reservation across five short turns', () => {
    const messages = ['Hi, I would like to book a table', 'four of us', 'Friday', '7pm', 'Dana Whitfield, 727-555-0142'];
    const history: ConversationTurn[] = [];
    let turn = runTurn({ config, message: messages[0], history, now });

    for (let i = 1; i < messages.length; i++) {
      history.push({ role: 'CUSTOMER', body: messages[i - 1] });
      history.push({ role: 'ASSISTANT', body: turn.reply });
      turn = runTurn({ config, message: messages[i], history, now });
    }

    expect(turn.bookingState).toBe('REQUESTED');
    expect(turn.slots).toMatchObject({
      partySize: 4,
      requestedDate: '2026-08-14',
      requestedTime: '19:00',
      customerName: 'Dana Whitfield',
      phone: '(727) 555-0142',
    });
    const lead = turn.actions.find((a) => a.type === 'CAPTURE_LEAD');
    expect(lead?.type === 'CAPTURE_LEAD' && lead.lead.category).toBe('RESERVATION');
  });

  it('does not repeat the opener on every turn of a conversation', () => {
    const turn = ask('Friday', [
      { role: 'CUSTOMER', body: 'I would like to book a table' },
      { role: 'ASSISTANT', body: 'Happy to help with a reservation. How many people will be joining you?' },
      { role: 'CUSTOMER', body: 'four of us' },
      { role: 'ASSISTANT', body: 'What date did you have in mind?' },
    ]);
    expect(turn.reply).not.toMatch(/happy to help with a reservation/i);
  });

  it('hands off to a person instead of asking the same question a third time', () => {
    const question = 'How many people will be joining you?';
    const history: ConversationTurn[] = [
      { role: 'CUSTOMER', body: 'I would like to book a table' },
      { role: 'ASSISTANT', body: `Happy to help with a reservation. ${question}` },
      { role: 'CUSTOMER', body: 'not sure yet' },
      { role: 'ASSISTANT', body: question },
      { role: 'CUSTOMER', body: 'hmm' },
    ];
    const turn = ask('I said I do not know', history);
    expect(turn.needsHuman).toBe(true);
    expect(turn.answerSource).toBe('ESCALATED');
    // Whatever was gathered still reaches the pipeline rather than being lost.
    expect(turn.actions.some((a) => a.type === 'CAPTURE_LEAD')).toBe(true);
  });

  it('keeps a month-and-day date phrase intact', () => {
    // This produced the bare fragment "december " in a confirmation message.
    const turn = ask('I need catering for 40 people on December 12th. Marcus, 727-555-0188');
    expect(turn.slots.requestedDateText).toBe('December 12th');
    expect(turn.reply).toContain('December 12th');
  });

  it('preserves the casing the customer used for a weekday', () => {
    const turn = ask('Table for 4 on Friday at 7pm, my name is Dana, 727-555-0142');
    expect(turn.reply).toContain('Friday');
    expect(turn.reply).not.toContain('friday');
  });

  it('declines an unconfigured delivery question instead of starting a booking', () => {
    // Delivery is disabled here. The engine used to fall through to slot
    // filling and ask "Can I get a name for the booking?" — implying a delivery
    // service that was never configured.
    const turn = ask('Do you deliver to Clearwater Beach?');
    expect(turn.answerSource).toBe('UNVERIFIED_DEFERRED');
    expect(turn.reply).toMatch(/not able to confirm/i);
    expect(turn.reply).not.toMatch(/for the booking/i);
    expect(turn.actions.some((a) => a.type === 'CAPTURE_LEAD')).toBe(true);
  });

  it('does not describe a lunchtime close as the evening', () => {
    // The café shuts at 3 PM; "closed for the evening" was wrong at 4 PM.
    const cafeAfternoon = new Date('2026-08-13T20:00:00Z'); // 16:00 New York
    const turn = runTurn({ config: demoTenantBConfig, message: 'Are you open?', now: cafeAfternoon, history: [] });
    expect(turn.reply).not.toMatch(/evening/i);
    expect(turn.reply).toMatch(/closed now/i);
  });
});

/**
 * Fixes from the PR #29 automated review.
 */
describe('a completed request is not captured twice', () => {
  /** Runs a full conversation and returns every turn, feeding history forward. */
  function runAll(messages: string[], tenant: TenantConfig = config) {
    const history: ConversationTurn[] = [];
    const turns = [];
    for (const message of messages) {
      const turn = runTurn({ config: tenant, message, history, now });
      turns.push(turn);
      history.push({ role: 'CUSTOMER', body: message });
      history.push({ role: 'ASSISTANT', body: turn.reply });
    }
    return turns;
  }

  it('does not re-capture the lead when the customer says thanks afterwards', () => {
    const turns = runAll([
      'Table for 4 on Friday at 7pm, my name is Dana Whitfield, 727-555-0142',
      'thanks!',
    ]);
    const captured = turns.flatMap((t) => t.actions).filter((a) => a.type === 'CAPTURE_LEAD');
    // Exactly one lead for one booking — a duplicate would inflate both the
    // owner's pipeline count and its estimated value.
    expect(captured).toHaveLength(1);
  });

  it('does not repeat the confirmation message', () => {
    const turns = runAll([
      'Table for 4 on Friday at 7pm, my name is Dana Whitfield, 727-555-0142',
      'thanks!',
    ]);
    expect(turns[0].reply).toMatch(/reservation request/i);
    expect(turns[1].reply).not.toMatch(/reservation request/i);
    expect(turns[1].bookingState).toBe('NONE');
  });

  it('does not create duplicate escalations for a completed catering request', () => {
    const turns = runAll([
      'I need catering for 40 people on December 12th. Marcus Reed, 727-555-0188',
      'ok great',
      'thank you',
    ]);
    const leads = turns.flatMap((t) => t.actions).filter((a) => a.type === 'CAPTURE_LEAD');
    const escalations = turns.flatMap((t) => t.actions).filter((a) => a.type === 'ESCALATE');
    expect(leads).toHaveLength(1);
    expect(escalations).toHaveLength(1);
  });

  it('still inherits the intent while the request is incomplete', () => {
    // The fix must not break terse mid-conversation answers.
    const turns = runAll(['I would like to book a table', 'four of us', 'Friday']);
    expect(turns[1].intent).toBe('RESERVATION');
    expect(turns[2].intent).toBe('RESERVATION');
    expect(turns[2].reply).toMatch(/time/i);
  });

  it('starts a genuinely new request after one has completed', () => {
    const turns = runAll([
      'Table for 4 on Friday at 7pm, my name is Dana Whitfield, 727-555-0142',
      'actually I also need catering for 60 people next month',
    ]);
    expect(turns[1].intent).toBe('CATERING');
  });
});

describe('escalation replies do not promise a notification the system cannot send', () => {
  // Outbound notification is Phase 2: an escalation writes a record staff see
  // on the dashboard, and sends nothing. The wording must reflect that.
  const CLAIMS_DISPATCH = /\b(alerting|notifying|paging|texting|calling|emailing)\b.*\b(team|staff|manager|management)\b|\bi am alerting\b|\bmaking sure .* sees this straight away\b/i;

  it.each([
    ['emergency', 'There is a fire in the dining room, this is an emergency'],
    ['food safety', 'I got sick after eating here last night'],
    ['legal threat', 'I am going to sue you and call my attorney'],
    ['refund', 'Give me a refund'],
    ['manager request', 'Let me talk to the manager'],
    ['complaint', 'The service last night was rude and the food was awful'],
  ])('%s reply does not claim staff are being alerted', (_label, message) => {
    expect(ask(message).reply).not.toMatch(CLAIMS_DISPATCH);
  });

  it('directs an emergency to 911 rather than to itself', () => {
    const turn = ask('There is a fire in the dining room, this is an emergency');
    expect(turn.reply).toMatch(/911/);
    expect(turn.reply).toMatch(/faster than I can|right away/i);
  });

  it('offers the restaurant phone number for time-critical matters', () => {
    const turn = ask('I got sick after eating here last night');
    expect(turn.reply).toContain(config.mainPhone!);
  });

  it('still records the escalation so it reaches the dashboard', () => {
    const turn = ask('I got sick after eating here last night');
    expect(turn.actions.some((a) => a.type === 'ESCALATE')).toBe(true);
    expect(turn.needsHuman).toBe(true);
  });
});
