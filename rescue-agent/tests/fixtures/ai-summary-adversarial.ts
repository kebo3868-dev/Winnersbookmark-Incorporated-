/**
 * Adversarial and acceptable AI-summary sentences for the PR #77 review at
 * 5764862. Shared by tests/ai-summary-authorization.test.ts.
 */
/** The one authorised form, in full. Every adversarial case below is a variation of it. */
export const GATED =
  "If the restaurant's own call records show measurable demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests for this restaurant and the owner approves it.";
export const TAIL_GATE = "only after the restaurant's own call records show measurable demand, it passes its own readiness and safety tests and the owner approves it.";
export const pilot = (conditions: string) => `The AI Front Desk could be considered as a limited, monitored pilot only after ${conditions}`;

export const REJECTED: Record<string, string[]> = {
  '1. negated measurable demand': [
    "If the restaurant's own call records do not show measurable demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests and the owner approves it.",
    pilot("the restaurant's own records show no measurable demand, it passes its own readiness and safety tests and the owner approves it."),
    pilot("the restaurant's own records fail to show demand, it passes its own readiness and safety tests and the owner approves it."),
    pilot("call records show insufficient demand, it passes its own readiness and safety tests and the owner approves it."),
    pilot('call records never confirm the demand, it passes its own readiness and safety tests and the owner approves it.'),
    "Although the restaurant's own records show no measurable demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests and the owner approves it.",
  ],
  '2. failed or incomplete readiness and safety tests': [
    pilot("the restaurant's own call records show measurable demand, it failed its own readiness and safety tests and the owner approves it."),
    pilot("the restaurant's own call records show measurable demand, its readiness and safety tests are incomplete and the owner approves it."),
    pilot("the restaurant's own call records show measurable demand, it has not passed its own readiness and safety tests and the owner approves it."),
    pilot("the restaurant's own call records show measurable demand, its readiness and safety tests are still pending and the owner approves it."),
    pilot("the restaurant's own call records show measurable demand, it passes its own readiness and safety tests, which it failed, and the owner approves it."),
  ],
  '3. withheld owner approval': [
    pilot("the restaurant's own call records show measurable demand, it passes its own readiness and safety tests and the owner has withheld approval."),
    pilot("the restaurant's own call records show measurable demand, it passes its own readiness and safety tests and the owner does not approve it."),
    pilot("the restaurant's own call records show measurable demand, it passes its own readiness and safety tests and the owner declines to approve it."),
    pilot("the restaurant's own call records show measurable demand, it passes its own readiness and safety tests and the owner approves it, which the owner has refused to do."),
    pilot("the restaurant's own call records show measurable demand and it passes its own readiness and safety tests, without the owner's approval."),
  ],
  '4. vendor approval in place of the owner\'s': [
    pilot("the restaurant's own call records show measurable demand, it passes its own readiness and safety tests and the vendor approves it."),
    pilot("the restaurant's own call records show measurable demand, it passes its own readiness and safety tests and Winnersbookmark approves it."),
    pilot("the restaurant's own call records show measurable demand, it passes its own readiness and safety tests and the provider approves the pilot."),
    pilot("the restaurant's own call records show measurable demand, it passes its own readiness and safety tests and the vendor's account manager approves it."),
    pilot("the restaurant's own call records show measurable demand, the vendor says it passes its own readiness and safety tests and the owner approves it."),
  ],
  '5. industry data in place of the restaurant\'s records': [
    pilot('industry call records show measurable demand, it passes its own readiness and safety tests and the owner approves it.'),
    pilot('national restaurant data show measurable demand, it passes its own readiness and safety tests and the owner approves it.'),
    pilot("the vendor's call records show measurable demand, it passes its own readiness and safety tests and the owner approves it."),
    pilot('benchmark data from similar restaurants show measurable demand, it passes its own readiness and safety tests and the owner approves it.'),
    pilot('the records show measurable demand, it passes its own readiness and safety tests and the owner approves it.'),
    pilot("other restaurants' call records show measurable demand, it passes its own readiness and safety tests and the owner approves it."),
  ],
  '6. telephone automation recommended without being named': [
    'Automatic telephone answering is what this restaurant needs.',
    'Put a digital telephone attendant in place.',
    'Calls should be picked up by software after hours.',
    'A machine should answer the phones during the dinner rush.',
    'Let an always-on answering line take the overflow.',
    'Phones could be answered automatically after hours.',
    'The restaurant needs round-the-clock coverage from a virtual host.',
    'An auto-attendant would be a sensible addition.',
    'Installing a phone tree is the right move.',
    'The best next step is a self-service phone line for reservations.',
    'Incoming calls ought to be routed without staff.',
    'A digital receptionist would suit the dinner rush.',
    'Reservations should be taken by an automated line.',
  ],
  '7. a safe sentence beside an unsafe one': [
    'No automation change is proposed. Put a digital telephone attendant in place.',
    'No automation change is proposed; however, an always-on answering line should go live this week.',
    'We do not recommend any automation. Set one up anyway.',
    `${GATED} Install it now.`,
    `${GATED} Meanwhile, calls should be picked up by software.`,
    'Catering automation is not recommended. The phones should be answered automatically instead.',
    "No automation change is proposed until the restaurant's own records confirm the demand. Until then, have software take the calls.",
  ],
  '9. automation described in other words (review of 449470c)': [
    'Route incoming calls through a speech engine.',
    'Let a speech engine field the dinner rush.',
    'Use a synthetic voice operator for reservations.',
    'A speech engine could field the dinner rush.',
    'Send overflow calls to a voice model.',
    'Have a text-to-speech service confirm reservations.',
    'Hand the phones to a neural voice after 9 p.m.',
    'Calls can be answered by a cloud voice service.',
    'A synthesized voice would take reservations at night.',
    'Forward missed calls to an answering platform.',
    'Let the website chat widget handle private-event inquiries.',
    'Have a conversational engine qualify catering inquiries.',
    'Inquiries should go to an agent that replies instantly.',
    'Point the phone line at a language model.',
    'Reservations could be confirmed by a voice program.',
    'Outsource the phones to a remote answering company.',
    'A virtual concierge could greet callers.',
    'Callers could be greeted by a recorded menu of options.',
    'Install a kiosk to take orders.',
    'Online chat should replace phone inquiries.',
    'Every call should be picked up within three rings by a digital helper.',
    "Leverock's would do well to let technology take reservations.",
    'Reservations are best handled by an app.',
    'Move reservations onto a self-booking tool.',
    'Delegate catering inquiries to an automated responder.',
    'The phones would be better covered by a bot.',
    'Get a speech engine.',
    'Buy a voice model subscription.',
    'Guests could text a number that replies on its own.',
    'Inquiries can be qualified without staff.',
  ],
  'conditions asserted as already met (keywords, not open conditions)': [
    "The restaurant's own records show measurable demand, the system passed its readiness and safety tests and the owner approved, so the AI Front Desk could be considered as a limited, monitored pilot.",
    "Since the restaurant's own call records show measurable demand, it has passed its readiness and safety tests and the owner has approved it, the AI Front Desk should be installed.",
    `The AI Front Desk could be considered as a limited, monitored pilot ${TAIL_GATE.replace('only after', 'now that')}`,
  ],
};

/** Genuinely acceptable conditional language: shown as written. */
/** Safe non-automation statements: descriptive, or recommending only website fixes and validation. */
export const SAFE_NON_AUTOMATION = [
  'Calls are not answered after 9 p.m., according to the posted hours.',
  'Whether calls go unanswered at dinner cannot be measured from public pages.',
  'Private-event inquiries arrive through a form on the events page.',
  'Fix the broken ordering link first.',
  'Update the hours on the contact page so they match the menu page.',
  'Pull 30 days of call records before deciding anything about the phones.',
  'Collect acknowledgment records and response times for recent event inquiries.',
  'The reservation link opens the booking page correctly.',
  'The menu is published as a PDF, which is hard to read on a phone.',
  'Confirm with the owner which ordering experience is intended.',
  'Calls placed through the order button reach the main phone line.',
  'Reservations are taken through a third-party booking page linked from the homepage.',
  'Private-event inquiries are routed through a contact form whose response time is not visible.',
  'How quickly the restaurant answers calls cannot be measured from public pages.',
  'Review the call records with the owner before any change.',
];

export const ACCEPTED = [
  GATED,
  'If call records confirm high, repetitive demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests and the owner approves it.',
  `The AI Front Desk could be considered as a limited, monitored pilot ${TAIL_GATE}`,
  `The AI Front Desk may be worth considering as a limited, monitored pilot, but ${TAIL_GATE}`,
  "AI-assisted inquiry intake might be evaluated as a limited, monitored pilot only after the restaurant's own inquiry records show measurable demand, the system has passed its own readiness and safety tests for this restaurant, and you approve the pilot.",
  "No automation change is proposed until the restaurant's own records confirm the demand.",
  'No automation is recommended at this stage.',
  'We do not recommend any automation until the call records confirm the demand.',
  'Catering automation is not recommended on public evidence alone.',
  'Winnersbookmark recommends an AI Discovery Audit as the next step to validate these findings against internal records.',
  'The most important issue is the online ordering button, which uses a telephone link instead of an online checkout; the owner should confirm which experience is intended and update the button or the section label.',
  "Phone demand and private-event inquiry handling cannot be measured from public pages and need the restaurant's own records.",
  'Fix the broken ordering link first.',
];

