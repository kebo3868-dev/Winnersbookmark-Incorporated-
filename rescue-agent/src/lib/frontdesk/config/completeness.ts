import type { TenantConfig } from './schema';

/**
 * MISSING INFORMATION REPORT (§XXII)
 *
 * Onboarding a restaurant is where this product succeeds or fails. A front
 * desk with half a configuration does not fail loudly — it quietly starts
 * saying "I'd have to check on that" to every third caller, and the owner
 * concludes the product does not work.
 *
 * So configuration gaps are made visible *before* activation, and each gap is
 * tied to the customer-facing capability it disables. Nothing is invented to
 * fill a hole.
 */

export type GapSeverity =
  /** Blocks activation. The front desk cannot do its core job without it. */
  | 'REQUIRED'
  /** Activation allowed, but a named capability stays switched off. */
  | 'RECOMMENDED'
  /** Nice to have; improves answer coverage. */
  | 'OPTIONAL';

export interface ConfigGap {
  field: string;
  severity: GapSeverity;
  /** Plain-English description for the onboarding checklist. */
  message: string;
  /** What the front desk will not be able to do until this is supplied. */
  capabilityLost: string;
}

export interface CompletenessReport {
  /** 0-100, weighted by severity. For operator progress display only. */
  score: number;
  readyToActivate: boolean;
  gaps: ConfigGap[];
  requiredGaps: ConfigGap[];
  /** Capabilities that are safe to switch on right now. */
  enabledCapabilities: string[];
}

const CAPABILITIES = {
  HOURS: 'Answer hours questions',
  LOCATION: 'Answer location, directions and parking questions',
  MENU: 'Answer menu questions',
  RESERVATIONS: 'Take reservation requests',
  ORDERING: 'Direct takeout and delivery orders',
  CATERING: 'Capture catering opportunities',
  EVENTS: 'Capture private-event opportunities',
  ESCALATION: 'Route customers to a human',
  FAQ: 'Answer restaurant-specific FAQs',
  REVIEWS: 'Invite reviews after good interactions',
  DIETARY: 'Answer dietary questions',
} as const;

export function buildCompletenessReport(config: TenantConfig): CompletenessReport {
  const gaps: ConfigGap[] = [];
  const enabled: string[] = [];

  const add = (field: string, severity: GapSeverity, message: string, capabilityLost: string) =>
    gaps.push({ field, severity, message, capabilityLost });

  // --- Identity and reachability -------------------------------------------
  if (!config.restaurantName.trim()) {
    add('restaurantName', 'REQUIRED', 'Restaurant name is missing.', 'Every greeting and message');
  }

  if (config.locations.length === 0) {
    add(
      'locations',
      'REQUIRED',
      'No location has been added. Add at least one with address and timezone.',
      CAPABILITIES.LOCATION,
    );
  } else {
    enabled.push(CAPABILITIES.LOCATION);
  }

  // --- Hours ---------------------------------------------------------------
  const locationsWithHours = config.locations.filter((l) => l.hours);
  if (config.locations.length > 0 && locationsWithHours.length === 0) {
    add(
      'locations[].hours',
      'REQUIRED',
      'No location has business hours. Hours are the single most common question a restaurant receives.',
      CAPABILITIES.HOURS,
    );
  } else if (locationsWithHours.length > 0) {
    enabled.push(CAPABILITIES.HOURS);
    if (locationsWithHours.length < config.locations.length) {
      add(
        'locations[].hours',
        'RECOMMENDED',
        `${config.locations.length - locationsWithHours.length} location(s) still have no hours.`,
        'Hours answers for those locations',
      );
    }
    if (config.locations.every((l) => l.holidayHours.length === 0)) {
      add(
        'locations[].holidayHours',
        'RECOMMENDED',
        'No holiday hours are configured. On holidays the front desk will decline to state hours rather than repeat the regular schedule.',
        'Accurate answers on holidays',
      );
    }
  }

  // --- Escalation ----------------------------------------------------------
  if (config.escalationContacts.length === 0) {
    add(
      'escalationContacts',
      'REQUIRED',
      'No human escalation contact is configured. Complaints, allergy questions and manager requests would have nowhere to go.',
      CAPABILITIES.ESCALATION,
    );
  } else {
    enabled.push(CAPABILITIES.ESCALATION);
    if (!config.escalationContacts.some((c) => c.key === 'manager')) {
      add(
        'escalationContacts',
        'RECOMMENDED',
        'No contact with the key "manager" exists. It is the fallback route for anything not explicitly mapped.',
        'Default escalation routing',
      );
    }
    const unreachable = config.escalationContacts.filter((c) => !c.phone && !c.email);
    if (unreachable.length > 0) {
      add(
        'escalationContacts',
        'REQUIRED',
        `Escalation contact(s) ${unreachable.map((c) => c.key).join(', ')} have neither a phone nor an email — staff would never be notified.`,
        CAPABILITIES.ESCALATION,
      );
    }
  }

  // --- Menu ----------------------------------------------------------------
  if (!config.menu.url && !config.menu.summary && config.menu.highlights.length === 0) {
    add(
      'menu',
      'RECOMMENDED',
      'No menu link or summary. Menu questions will be deferred to staff.',
      CAPABILITIES.MENU,
    );
  } else {
    enabled.push(CAPABILITIES.MENU);
  }

  if (config.menu.dietaryOptions.length === 0) {
    add(
      'menu.dietaryOptions',
      'OPTIONAL',
      'No verified dietary options listed. Vegetarian/vegan/gluten-free questions will be deferred.',
      CAPABILITIES.DIETARY,
    );
  } else {
    enabled.push(CAPABILITIES.DIETARY);
  }

  // --- Revenue pathways ----------------------------------------------------
  if (!config.reservations.enabled) {
    add(
      'reservations',
      'RECOMMENDED',
      'Reservations are switched off. Reservation requests will still be captured as leads, but no booking pathway can be offered.',
      CAPABILITIES.RESERVATIONS,
    );
  } else if (!config.reservations.url && !config.reservations.phone) {
    add(
      'reservations',
      'REQUIRED',
      'Reservations are enabled but have no booking link or phone number to send customers to.',
      CAPABILITIES.RESERVATIONS,
    );
  } else {
    enabled.push(CAPABILITIES.RESERVATIONS);
  }

  const orderingOn = config.takeout.enabled || config.delivery.enabled;
  if (!orderingOn) {
    add(
      'takeout / delivery',
      'RECOMMENDED',
      'Neither takeout nor delivery is configured. Ordering questions will be deferred to staff.',
      CAPABILITIES.ORDERING,
    );
  } else {
    const broken = [
      config.takeout.enabled && !config.takeout.url && !config.takeout.phone ? 'takeout' : null,
      config.delivery.enabled && !config.delivery.url && !config.delivery.phone ? 'delivery' : null,
    ].filter(Boolean);
    if (broken.length > 0) {
      add(
        broken.join(' / '),
        'REQUIRED',
        `${broken.join(' and ')} enabled with no link or phone number.`,
        CAPABILITIES.ORDERING,
      );
    } else {
      enabled.push(CAPABILITIES.ORDERING);
    }
  }

  // Catering and private events are the highest-value inquiries the front desk
  // handles, so a missing contact is called out loudly even though the lead is
  // still captured without it.
  if (config.catering.enabled) {
    enabled.push(CAPABILITIES.CATERING);
    if (!config.escalationContacts.some((c) => c.key === (config.escalationRouting.CATERING ?? 'catering'))) {
      add(
        'escalationRouting.CATERING',
        'RECOMMENDED',
        'Catering is enabled but no catering contact is configured — high-value catering leads will fall back to the manager.',
        'Direct catering notifications',
      );
    }
  } else {
    add(
      'catering',
      'RECOMMENDED',
      'Catering is switched off. Catering enquiries will be captured as general leads only.',
      CAPABILITIES.CATERING,
    );
  }

  if (config.privateEvents.enabled) {
    enabled.push(CAPABILITIES.EVENTS);
  } else {
    add(
      'privateEvents',
      'RECOMMENDED',
      'Private events are switched off. Event enquiries will be captured as general leads only.',
      CAPABILITIES.EVENTS,
    );
  }

  // --- Answer coverage -----------------------------------------------------
  if (config.faqs.length === 0) {
    add('faqs', 'OPTIONAL', 'No FAQs supplied. Unusual questions will be deferred to staff.', CAPABILITIES.FAQ);
  } else {
    enabled.push(CAPABILITIES.FAQ);
  }

  if (!config.reviewLink) {
    add('reviewLink', 'OPTIONAL', 'No review link supplied.', CAPABILITIES.REVIEWS);
  } else {
    enabled.push(CAPABILITIES.REVIEWS);
  }

  if (!config.thresholds.averageCheckCents) {
    add(
      'thresholds.averageCheckCents',
      'OPTIONAL',
      'No average check value. Leads will be captured without an estimated opportunity value.',
      'Estimated opportunity value in reports',
    );
  }

  if (config.messaging.smsEnabled && !config.messaging.fromNumber) {
    add(
      'messaging.fromNumber',
      'REQUIRED',
      'SMS is enabled but no sending number is configured.',
      'Missed-call recovery and SMS conversations',
    );
  }

  const requiredGaps = gaps.filter((g) => g.severity === 'REQUIRED');
  const weights: Record<GapSeverity, number> = { REQUIRED: 12, RECOMMENDED: 4, OPTIONAL: 1 };
  const penalty = gaps.reduce((sum, g) => sum + weights[g.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    score,
    readyToActivate: requiredGaps.length === 0,
    gaps,
    requiredGaps,
    enabledCapabilities: [...new Set(enabled)],
  };
}
