/**
 * Cases for the shared narrative policy (src/lib/reports/narrativePolicy.ts),
 * used by the release-safety and Sales Brief tests. Every case in
 * ADVERSARIAL_NARRATIVE must be rejected wherever it is stored; every case in
 * SAFE_NARRATIVE must be shown as written.
 */
import { REJECTED, SAFE_NON_AUTOMATION } from './ai-summary-adversarial';

/** Reported in the review of 1e2c271. */
export const REPORTED_1E2C271 = [
  'Calls are to be answered by a prerecorded greeter.',
  'A speech engine could field all of the late evening calls.',
  'The AI Front Desk is available. It should be installed.',
];

/** Passive voice, indirect wording, synonyms. */
export const GUEST_HANDLING = [
  'Late calls would be picked up by a recorded assistant.',
  'The phones ought to be covered by a talking kiosk.',
  'Overflow calls will roll to a digital line that books tables.',
  'Have reservations confirmed by text without anyone involved.',
  'Event inquiries are best acknowledged by a responder that never sleeps.',
  'Guests should reach a voice that takes their order after hours.',
  'It would help if the late calls went to a recorded menu.',
  'Let the after-hours line take bookings by itself.',
  'Each inquiry could be answered within seconds by a trained model.',
  'Callers might be greeted by a lifelike synthetic host.',
  'Reservations can be handled end to end without staff.',
  'Missed calls should trigger an instant reply.',
  'The dinner rush is a job for a phone bot.',
  'Hand the phones to software at 9 p.m.',
  'Calls are to be routed to a remote answering service.',
  'A virtual front-of-house could manage reservations.',
  'Bookings ought to be confirmed automatically.',
  'Use text-to-speech to read the specials to callers.',
  'Calls should be answered by a new system.',
];

/** A recommendation split across sentences: the second refers back. */
export const MULTI_SENTENCE = [
  'A voice assistant exists for restaurants. Put one in place.',
  'There is a tool that answers calls. The restaurant would benefit from it.',
  "Automatic answering is common now. Leverock's should consider it.",
  'The AI Front Desk was reviewed. This is the right next step.',
  'A speech engine handles late calls well. Adopt it.',
];

/** Buying or switching to a product. */
export const ACQUISITION = [
  'Get a voice model subscription.',
  'Sign up for a conversational ordering platform.',
  'Buy the AI Front Desk.',
  'The restaurant needs an automated reservations system.',
  'Get a new reservations system.',
];

/** The gate's wording, naming the wrong restaurant, product or approver. */
export const WRONG_ENTITY = [
  "Because another restaurant's call records show measurable demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests and the owner approves it.",
  "If Harbor Grill's own call records show measurable demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests and the owner approves it.",
  "If the restaurant's own call records show measurable demand, the AI Front Desk could be considered as a limited, monitored pilot only after the Harbor booking app passes its own readiness and safety tests and the owner approves it.",
  "If the restaurant's own call records show measurable demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests and the owner of Harbor Grill approves it.",
  "If the restaurant's own call records show measurable demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests and the general manager approves it.",
];

export const ADVERSARIAL_NARRATIVE = [
  ...REPORTED_1E2C271,
  ...GUEST_HANDLING,
  ...MULTI_SENTENCE,
  ...ACQUISITION,
  ...WRONG_ENTITY,
  ...Object.values(REJECTED).flat(),
];

/** Operational improvements, human staffing and observations of existing services. */
export const OPERATIONAL = [
  'Reservations are taken through OpenTable, linked from the homepage.',
  'The restaurant already uses an automated reservation confirmation from its booking provider.',
  'The restaurant uses an answering service after hours, according to its voicemail greeting.',
  'Restyle the booking widget so its buttons match the brand colours.',
  'Fix the booking widget so the date picker works on a phone.',
  'Repair the contact form so inquiries reach the events inbox.',
  "Route contact-form inquiries to the events manager's inbox.",
  'Hire a host to answer calls during the dinner rush.',
  'Hire a receptionist to cover the phones at lunch.',
  'Assign a staff member to return missed calls each morning.',
  'The manager should call back every unanswered inquiry the same day.',
  'The manager should return after-hours calls the next morning.',
  'Our audit found the ordering button is set up as a phone link rather than an online checkout.',
  'Calls are answered by the host stand during service.',
  'Guests can book online through OpenTable.',
  'The booking widget can be reached from the homepage.',
];

export const SAFE_NARRATIVE = [...OPERATIONAL, ...SAFE_NON_AUTOMATION];
