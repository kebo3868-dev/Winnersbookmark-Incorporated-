import type { EvidenceRecordLike, JourneyStageResult, JourneyStageName } from '@/types/audit';
import { parseOrderingChannelFact } from '@/lib/audit/orderingChannel';

type EvidenceIndex = Map<string, EvidenceRecordLike[]>;

function indexEvidence(evidence: EvidenceRecordLike[]): EvidenceIndex {
  const index: EvidenceIndex = new Map();
  for (const item of evidence) {
    const list = index.get(item.evidenceType) ?? [];
    list.push(item);
    index.set(item.evidenceType, list);
  }
  return index;
}

const has = (index: EvidenceIndex, type: string, predicate?: (e: EvidenceRecordLike) => boolean) =>
  (index.get(type) ?? []).filter((e) => (predicate ? predicate(e) : true));

const positive = (e: EvidenceRecordLike) => !/no |not |lacks|without|failed|could not/i.test(e.fact.slice(0, 60));
const negative = (e: EvidenceRecordLike) => !positive(e);

const ids = (items: EvidenceRecordLike[]) => items.map((e) => e.id);
const avgConfidence = (items: EvidenceRecordLike[], fallback: number) =>
  items.length === 0 ? fallback : Math.round(items.reduce((s, e) => s + e.confidence, 0) / items.length);

/**
 * Deterministic customer journey analysis. Reasons only over stored evidence —
 * no stage conclusion is produced without at least one supporting evidence record,
 * and stages without evidence return UNKNOWN.
 */
export function analyzeJourney(evidence: EvidenceRecordLike[]): JourneyStageResult[] {
  const index = indexEvidence(evidence);
  const results: JourneyStageResult[] = [];

  const push = (r: JourneyStageResult) => results.push(r);

  // DISCOVERY — metadata / structured data / identity signals only.
  {
    const identity = has(index, 'BUSINESS_IDENTITY');
    const technical = has(index, 'TECHNICAL_SIGNAL');
    const missingMeta = technical.filter((e) => /no <title>|no meta description/i.test(e.fact));
    if (identity.length === 0 && technical.length === 0) {
      push(stage('DISCOVERY', 'UNKNOWN', 'Insufficient public signals to assess search discovery.', 30, true, []));
    } else if (missingMeta.length > 0) {
      push(
        stage(
          'DISCOVERY',
          'FRICTION',
          'Basic search presentation signals (title/meta description) are incomplete, weakening how the restaurant appears in search results.',
          avgConfidence(missingMeta, 70),
          false,
          ids([...identity, ...missingMeta]),
        ),
      );
    } else {
      push(
        stage(
          'DISCOVERY',
          'HEALTHY',
          'Core identity and metadata signals are present. Full local search ranking analysis requires manual validation.',
          avgConfidence(identity, 70),
          true,
          ids(identity),
        ),
      );
    }
  }

  // WEBSITE
  {
    const failures = has(index, 'COLLECTION_FAILURE');
    const mobile = has(index, 'MOBILE_SIGNAL');
    const badMobile = mobile.filter((e) => /lacks/i.test(e.fact));
    const insecure = has(index, 'TECHNICAL_SIGNAL', (e) => /HTTPS|not secure/i.test(e.fact));
    const homeDown = failures.filter((e) => /primary website/i.test(e.fact));
    if (homeDown.length > 0) {
      push(stage('WEBSITE', 'RISK', 'The primary website could not be collected — customers may be failing to reach it too.', 85, true, ids(homeDown)));
    } else if (badMobile.length > 0 || insecure.length > 0) {
      push(
        stage(
          'WEBSITE',
          'RISK',
          'The website shows foundational technical problems (mobile configuration and/or HTTPS) that directly affect customer trust and usability.',
          avgConfidence([...badMobile, ...insecure], 75),
          false,
          ids([...badMobile, ...insecure]),
        ),
      );
    } else if (failures.length > 0) {
      push(stage('WEBSITE', 'FRICTION', 'The website is reachable but some linked pages failed to load during collection.', avgConfidence(failures, 75), false, ids([...failures, ...mobile])));
    } else {
      push(stage('WEBSITE', 'HEALTHY', 'The website loaded successfully with basic mobile configuration in place.', avgConfidence(mobile, 75), false, ids(mobile)));
    }
  }

  // PHONE
  {
    const phone = has(index, 'PHONE_VISIBILITY');
    const phoneMissing = phone.filter(negative);
    const c2c = has(index, 'CLICK_TO_CALL');
    const c2cMissing = c2c.filter(negative);
    const faq = has(index, 'FAQ_SIGNAL');
    const faqMissing = faq.filter(negative);
    const all = [...phone, ...c2c, ...faq];
    if (phoneMissing.some((e) => /any analyzed page/i.test(e.fact))) {
      push(stage('PHONE', 'RISK', 'No phone number was detected on the analyzed pages — phone-intent customers have no visible path to call.', avgConfidence(phoneMissing, 65), true, ids(all)));
    } else if (c2cMissing.length > 0 || faqMissing.length > 0) {
      push(
        stage(
          'PHONE',
          'FRICTION',
          'The phone channel carries load that the website does not absorb: ' +
            [c2cMissing.length > 0 ? 'mobile visitors cannot tap to call' : '', faqMissing.length > 0 ? 'no FAQ answers common questions before customers dial' : '']
              .filter(Boolean)
              .join('; ') +
            '. This is a phone-dependent customer journey with potential missed-call exposure during service hours.',
          avgConfidence(all, 70),
          true,
          ids(all),
        ),
      );
    } else {
      push(stage('PHONE', 'HEALTHY', 'Phone number is visible with click-to-call enabled and FAQ support online. Actual call answer rates require manual validation.', avgConfidence(all, 70), true, ids(all)));
    }
  }

  // MENU
  {
    const menu = has(index, 'MENU_ACCESS');
    const missing = menu.filter((e) => /no public menu/i.test(e.fact));
    const pdfOnly = menu.filter((e) => /only detected menu links point to pdf/i.test(e.fact));
    // A menu page that loads with no menu on it. Friction, not a dead end.
    const placeholder = menu.filter((e) => /has no menu published on it yet/i.test(e.fact));
    const broken = has(index, 'BROKEN_LINK', (e) => /menu/i.test(e.fact));
    if (menu.length === 0) {
      push(stage('MENU', 'UNKNOWN', 'Menu accessibility could not be assessed.', 30, true, []));
    } else if (missing.length > 0) {
      push(stage('MENU', 'RISK', 'No public menu pathway was detected — the single most-requested piece of restaurant information is not obviously reachable.', avgConfidence(missing, 65), true, ids(menu)));
    } else if (broken.length > 0) {
      push(stage('MENU', 'RISK', 'A linked menu destination failed when tested.', avgConfidence(broken, 85), false, ids([...menu, ...broken])));
    } else if (placeholder.length > 0) {
      push(stage('MENU', 'FRICTION', 'The menu link leads to a page with no menu published on it yet — customers looking for the menu do not find one.', avgConfidence(placeholder, 85), false, ids(menu)));
    } else if (pdfOnly.length > 0) {
      push(stage('MENU', 'FRICTION', 'The menu is only available as PDF downloads, which are slow and hard to read on phones.', avgConfidence(pdfOnly, 75), false, ids(menu)));
    } else {
      // MENU deliberately keeps HEALTHY. Reading a menu is not a transaction the
      // business can switch off, so a reachable menu page IS a working menu —
      // unlike a booking or ordering page, where reachability proves nothing.
      push(stage('MENU', 'HEALTHY', 'A menu pathway is publicly linked and reachable.', avgConfidence(menu, 80), false, ids(menu)));
    }
  }

  // RESERVATION
  {
    const res = has(index, 'RESERVATION_PATH');
    const widget = res.filter((e) => /widget was detected/i.test(e.fact));
    const missing = res.filter((e) => /no public reservation pathway was detected/i.test(e.fact));
    const broken = has(index, 'BROKEN_LINK', (e) => /reservation/i.test(e.fact));
    // The destination's own page says bookings are off. Worse than unverified:
    // this is a known dead end for a customer who arrives with booking intent.
    const unavailable = res.filter((e) => /states the service is unavailable/i.test(e.fact));
    // A destination that exists but could not be driven from the public page —
    // an endpoint that refused the audit's GET, a timeout, a safety block.
    // Checked before the reachable-and-unverified fallback and never treated as
    // a failure: the evidence layer has already refused to call it broken, and
    // re-deriving a dead end here would put the false positive straight back.
    const unverified = res.filter((e) => /manual validation required/i.test(e.fact));
    if (res.length === 0) {
      push(stage('RESERVATION', 'UNKNOWN', 'Reservation experience could not be assessed.', 30, true, []));
    } else if (broken.length > 0) {
      push(stage('RESERVATION', 'RISK', 'The reservation link failed when tested — booking-intent customers hit a dead end.', avgConfidence(broken, 85), false, ids([...res, ...broken])));
    } else if (widget.length > 0) {
      push(
        stage(
          'RESERVATION',
          'UNKNOWN',
          'A third-party booking widget was detected, but its destination is rendered in the browser and could not be verified from the public page. Whether customers can actually complete a booking requires manual validation.',
          avgConfidence(widget, 55),
          true,
          ids(res),
        ),
      );
    } else if (missing.length > 0) {
      push(
        stage(
          'RESERVATION',
          'UNKNOWN',
          'No public reservation pathway was detected. The restaurant may be walk-in only or take bookings by phone — manual validation required before treating this as a gap.',
          avgConfidence(missing, 60),
          true,
          ids(res),
        ),
      );
    } else if (unavailable.length > 0) {
      push(
        stage(
          'RESERVATION',
          'RISK',
          'The reservation destination is reachable but states that bookings are not available — booking-intent customers arrive at a page that cannot take their reservation.',
          avgConfidence(unavailable, 90),
          false,
          ids([...res, ...unavailable]),
        ),
      );
    } else if (unverified.length > 0) {
      // An embedded widget, or an endpoint that exists and could not be driven
      // from the public HTML. This is the MANUAL_VALIDATION_REQUIRED case: a
      // real thing was seen, and what a customer experiences is unresolved.
      // Emphatically not a failure — an HTTP 405 from a booking API is the
      // server refusing the audit's GET, not a customer hitting a dead end.
      push(
        stage(
          'RESERVATION',
          'UNKNOWN',
          'A reservation destination exists, but the customer booking flow could not be completed from the public page, so whether a customer can book is unresolved. This is not evidence that booking is broken — it is evidence that a human needs to open the page and try. Manual validation required.',
          avgConfidence(unverified, 60),
          true,
          ids(res),
        ),
      );
    } else {
      // Reachability is not functionality. A booking page with reservations
      // switched off returns 200 and renders normally, so responding proves the
      // destination exists — never that a customer can book. HEALTHY here would
      // be a claim the audit has not earned.
      push(
        stage(
          'RESERVATION',
          'RESOLVED_UNVERIFIED',
          'A reservation pathway is publicly linked and the destination is reachable, but whether customers can actually complete a booking was not verified — a booking page with reservations switched off responds identically. Manual validation required.',
          avgConfidence(res, 75),
          true,
          ids(res),
        ),
      );
    }
  }

  // ORDERING
  //
  // Driven by the canonical ORDERING_CHANNEL record when one is present. The
  // channel decision is made once, in the evidence layer, against the raw
  // signals; the branches here present that decision rather than making a
  // second, slightly different judgement out of prose.
  //
  // Phone ordering is a legitimate ordering pathway and is NOT online ordering,
  // which is the distinction the single-status model kept losing.
  //
  // The prose-matching chain below is the fallback for evidence sets produced
  // without a channel record — stored audits, and direct callers. It is
  // unreachable whenever a channel record exists.
  {
    const channelRecord = (index.get('ORDERING_CHANNEL') ?? [])[0];
    const channel = channelRecord ? parseOrderingChannelFact(channelRecord.fact) : null;
    if (channelRecord && channel) {
      const evidenceIds = ids([...has(index, 'ORDERING_PATH'), channelRecord]);
      const confidence = channelRecord.confidence;
      const summary = channelRecord.fact.replace(/^ORDERING CHANNEL:\s*[A-Z_]+(\s*\[DESTINATION_RESOLVED\])?\s*—\s*/, '');
      if (channel.state === 'ONLINE_ORDERING_BROKEN_CONFIRMED') {
        // The channel summary states the failure; this adds the consequence
        // once. Both used to carry a dead-end clause, so the card said it twice.
        push(stage('ORDERING', 'RISK', `${summary} Order-intent customers hit a dead end.`, confidence, false, evidenceIds));
      } else if (channel.state === 'PHONE_ORDERING_ONLY') {
        push(
          stage(
            'ORDERING',
            'FRICTION',
            `${summary} Order-intent customers who will not call are lost, and staff answer the phone during service.`,
            confidence,
            true,
            evidenceIds,
          ),
        );
      } else if (channel.state === 'THIRD_PARTY_ORDERING') {
        push(
          stage(
            'ORDERING',
            'FRICTION',
            `${summary} Third-party platforms take a commission and own the customer relationship, and whether an order can be completed on them was not verified.`,
            confidence,
            true,
            evidenceIds,
          ),
        );
      } else if (channel.state === 'ONLINE_ORDERING_WORKING') {
        push(stage('ORDERING', 'HEALTHY', summary, confidence, false, evidenceIds));
      } else if (channel.destinationResolved) {
        // A destination WAS resolved and responded; only order placement is
        // unverified. RESOLVED_UNVERIFIED, not UNKNOWN — the distinction is
        // scored, and collapsing it would drop the ordering category out of the
        // Rescue Score entirely for a restaurant that has an ordering page.
        push(stage('ORDERING', 'RESOLVED_UNVERIFIED', `${summary} Manual validation required.`, confidence, true, evidenceIds));
      } else {
        push(stage('ORDERING', 'UNKNOWN', `${summary} Manual validation required.`, confidence, true, evidenceIds));
      }
    } else {
    const ord = has(index, 'ORDERING_PATH');
    const widget = ord.filter((e) => /widget was detected/i.test(e.fact));
    const missing = ord.filter((e) => /no public online ordering pathway was detected/i.test(e.fact));
    const competing = ord.filter((e) => /competing ordering destinations/i.test(e.fact));
    const broken = has(index, 'BROKEN_LINK', (e) => /ordering/i.test(e.fact));
    // Telephone ordering is checked before the healthy fallback, and before the
    // widget branch: a resolved destination must not outrank the action a
    // customer is actually offered. A dead link still wins, because a broken
    // pathway is a worse finding than a working phone.
    const telephone = ord.filter((e) => /ordering is offered by telephone/i.test(e.fact));
    // The destination's own page says ordering is off — a known dead end, not
    // merely unverified.
    const unavailableOrd = ord.filter((e) => /states the service is unavailable/i.test(e.fact));
    if (ord.length === 0) {
      push(stage('ORDERING', 'UNKNOWN', 'Online ordering experience could not be assessed.', 30, true, []));
    } else if (broken.length > 0) {
      push(stage('ORDERING', 'RISK', 'An ordering link failed when tested — order-intent customers hit a dead end.', avgConfidence(broken, 85), false, ids([...ord, ...broken])));
    } else if (telephone.length > 0) {
      push(
        stage(
          'ORDERING',
          'FRICTION',
          'Ordering is by telephone only — the website\'s ordering call-to-action places a phone call rather than opening an online ordering page. Order-intent customers who will not call are lost, and staff answer the phone during service.',
          avgConfidence(telephone, 85),
          true,
          ids(ord),
        ),
      );
    } else if (unavailableOrd.length > 0) {
      push(
        stage(
          'ORDERING',
          'RISK',
          'The ordering destination is reachable but states that ordering is not available — order-intent customers arrive at a page that cannot take their order.',
          avgConfidence(unavailableOrd, 90),
          false,
          ids(ord),
        ),
      );
    } else if (competing.length > 0) {
      push(stage('ORDERING', 'FRICTION', 'Multiple competing ordering platforms are linked, splitting order-intent traffic and creating potential margin exposure through third-party dependency.', avgConfidence(competing, 75), true, ids(ord)));
    } else if (widget.length > 0) {
      push(stage('ORDERING', 'UNKNOWN', 'A third-party ordering widget was detected, but its destination is rendered in the browser and could not be verified from the public page. Whether customers can actually place an order requires manual validation.', avgConfidence(widget, 55), true, ids(ord)));
    } else if (missing.length > 0) {
      push(stage('ORDERING', 'UNKNOWN', 'No public online ordering pathway was detected. The restaurant may be dine-in focused — manual validation required.', avgConfidence(missing, 60), true, ids(ord)));
    } else {
      // Same rule as RESERVATION: an ordering page with online ordering
      // switched off returns 200 and renders normally, so responding proves the
      // destination exists — never that an order can be placed.
      push(
        stage(
          'ORDERING',
          'RESOLVED_UNVERIFIED',
          'An online ordering pathway is publicly linked and the destination is reachable, but whether customers can actually place an order was not verified — an ordering page with ordering switched off responds identically. Manual validation required.',
          avgConfidence(ord, 75),
          true,
          ids(ord),
        ),
      );
    }
    }
  }

  // CONTACT
  {
    const contact = has(index, 'CONTACT_PATH');
    const hours = has(index, 'HOURS_VISIBILITY');
    const address = has(index, 'ADDRESS_VISIBILITY');
    const gaps = [...contact.filter(negative), ...hours.filter(negative), ...address.filter(negative)];
    const all = [...contact, ...hours, ...address];
    // Reachable by phone, with no written route in. A real finding — and a
    // different one from "no contact pathway exists", which was what the audit
    // used to say about a restaurant that publishes its number.
    const phoneOnlyContact = contact.filter((e) => /no non-phone contact route/i.test(e.fact));
    if (all.length === 0) {
      push(stage('CONTACT', 'UNKNOWN', 'Contact accessibility could not be assessed.', 30, true, []));
    } else if (phoneOnlyContact.length > 0) {
      push(
        stage(
          'CONTACT',
          'FRICTION',
          'Customers can reach the restaurant by phone, and the phone is the only route in — no contact page, enquiry form, or published email was detected. Every question becomes a call, and anything asked outside service hours waits.',
          avgConfidence(phoneOnlyContact, 85),
          false,
          ids(all),
        ),
      );
    } else if (gaps.length >= 2) {
      push(stage('CONTACT', 'RISK', 'Multiple core contact facts (contact path, hours, address) were not detected on the analyzed pages.', avgConfidence(gaps, 60), true, ids(all)));
    } else if (gaps.length === 1) {
      push(stage('CONTACT', 'FRICTION', `One core contact element is weak: ${gaps[0].fact}`, avgConfidence(gaps, 65), false, ids(all)));
    } else {
      push(stage('CONTACT', 'HEALTHY', 'Contact path, hours, and address are publicly visible.', avgConfidence(all, 80), false, ids(all)));
    }
  }

  // FOLLOW_UP
  {
    const email = has(index, 'EMAIL_CAPTURE');
    const sms = has(index, 'SMS_CAPTURE');
    const loyalty = has(index, 'LOYALTY_SIGNAL');
    const captures = [...email.filter(positive), ...sms.filter(positive), ...loyalty.filter(positive)];
    const all = [...email, ...sms, ...loyalty];
    if (all.length === 0) {
      push(stage('FOLLOW_UP', 'UNKNOWN', 'Customer follow-up systems could not be assessed from public signals.', 30, true, []));
    } else if (captures.length === 0) {
      push(
        stage(
          'FOLLOW_UP',
          'RISK',
          'No public retention mechanism (email capture, SMS club, or loyalty program) was detected. This does not prove no internal database exists — but the website is not visibly building one.',
          avgConfidence(all, 60),
          true,
          ids(all),
        ),
      );
    } else if (captures.length === 1) {
      push(stage('FOLLOW_UP', 'FRICTION', 'A single public retention signal was detected; the follow-up system appears basic.', avgConfidence(all, 65), true, ids(all)));
    } else {
      push(stage('FOLLOW_UP', 'HEALTHY', 'Multiple public retention mechanisms are visible.', avgConfidence(captures, 75), false, ids(all)));
    }
  }

  // REVIEW — owner-reported only (Phase 3). Rating drives status when provided;
  // otherwise stays UNKNOWN. Response-pattern/recency still need platform access.
  {
    const reviews = has(index, 'REVIEW_SIGNAL');
    const ratingEv = reviews.find((e) => /rating:/i.test(e.fact));
    const ratingMatch = ratingEv?.fact.match(/(\d(?:\.\d)?)\s*★/);
    if (reviews.length === 0) {
      push(stage('REVIEW', 'UNKNOWN', 'No review data was provided and public review platforms are not scraped. Share your Google/Yelp rating to include reputation in the audit.', 20, true, []));
    } else if (ratingMatch) {
      const rating = parseFloat(ratingMatch[1]);
      const status = rating >= 4.3 ? 'HEALTHY' : rating >= 3.8 ? 'FRICTION' : 'RISK';
      push(
        stage(
          'REVIEW',
          status,
          `Owner-reported rating of ${rating.toFixed(1)}★. Reputation is included from provided data; response-pattern and recency analysis still require direct platform access.`,
          avgConfidence(reviews, 55),
          true,
          ids(reviews),
        ),
      );
    } else {
      push(stage('REVIEW', 'FRICTION', 'A review profile was provided but no rating was shared, so reputation strength cannot be assessed. Provide the current star rating to complete this.', avgConfidence(reviews, 45), true, ids(reviews)));
    }
  }

  // RETURN
  {
    const retention = [...has(index, 'EMAIL_CAPTURE'), ...has(index, 'LOYALTY_SIGNAL'), ...has(index, 'GIFT_CARD_SIGNAL')];
    const positives = retention.filter(positive);
    if (retention.length === 0) {
      push(stage('RETURN', 'UNKNOWN', 'Repeat-visit systems could not be assessed.', 30, true, []));
    } else if (positives.length === 0) {
      push(stage('RETURN', 'RISK', 'No visible mechanism invites customers back (loyalty, gift cards, or owned contact list detected: none). Repeat business appears to depend entirely on memory.', avgConfidence(retention, 60), true, ids(retention)));
    } else {
      push(stage('RETURN', 'FRICTION', 'Some repeat-visit mechanisms exist publicly; depth of use requires manual validation.', avgConfidence(positives, 65), true, ids(retention)));
    }
  }

  return results;
}

function stage(
  stageName: JourneyStageName,
  status: JourneyStageResult['status'],
  finding: string,
  confidence: number,
  manualValidationRequired: boolean,
  evidenceIds: string[],
): JourneyStageResult {
  return { stage: stageName, status, finding, confidence: clamp(confidence), manualValidationRequired, evidenceIds };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
