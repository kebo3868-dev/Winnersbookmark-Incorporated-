import {
  detectWidgetVendor,
  normalizePhonesInText,
  type CategorizedLink,
  type PageExtract,
  type UnverifiedForm,
} from '@/lib/web/collector';
import type { EvidenceInput } from '@/types/audit';
import { UNVERIFIED_SIGNUP_FACT } from '@/lib/audit/emailCaptureState';
import { normalizeUrl } from '@/lib/validation/url';
import {
  classifyDestination,
  isMethodSemanticsRefusal,
  mayClaimVerifiedBroken,
  type DestinationKind,
  type ProbeFailureKind,
} from '@/lib/audit/destination';
import {
  formatOrderingChannelFact,
  resolveOrderingChannel,
  type OrderingDestination,
  type OrderingProbe,
} from '@/lib/audit/orderingChannel';

export interface ProbeResult {
  url: string;
  category: 'reservation' | 'ordering' | 'menu';
  ok: boolean;
  httpStatus?: number;
  note: string;
  /** Page a customer can open, or a machine interface. Decides what a failure may be called. */
  destinationKind?: DestinationKind;
  /** Why the probe did not succeed, when it did not. */
  failureKind?: ProbeFailureKind;
  /** The destination exists and refused the audit's GET. Never a customer-facing failure. */
  methodNotAllowed?: boolean;
  /**
   * True when this destination is offered to customers in the served markup,
   * rather than merely supplied as an owner hint. A destination no customer is
   * ever shown cannot demonstrate anything about the customer journey.
   */
  exposedInCustomerJourney?: boolean;
  /** Destination reached after redirects, when it differs from the link href. */
  finalUrl?: string;
  /**
   * Set when the destination's own page says the service is unavailable —
   * bookings closed, ordering disabled. Present only as a downgrade; its
   * absence means "not verified", never "verified working".
   */
  disabledSignal?: string;
  /**
   * Set when a MENU destination loads but says its content is not there yet
   * ("menu coming soon"). Friction, not a dead end — and separate from
   * disabledSignal because a menu is read, not transacted.
   */
  placeholderSignal?: string;
}

export interface CollectionSet {
  pages: PageExtract[];
  failures: { url: string; sourceType: string; status: string; note: string }[];
  probes: ProbeResult[];
}

/**
 * Convert raw collected pages into precise, source-attributed evidence facts.
 * Absence is always phrased as "not detected on analyzed pages" — never as
 * proof the restaurant lacks the capability.
 */
export function normalizeEvidence(collection: CollectionSet): EvidenceInput[] {
  const { pages, failures, probes } = collection;
  const evidence: EvidenceInput[] = [];
  const home = pages[0];
  if (!home) {
    for (const f of failures) {
      evidence.push({
        sourceUrl: f.url,
        evidenceType: 'COLLECTION_FAILURE',
        fact: `Primary website could not be collected (${f.status}).`,
        supportingContext: f.note,
        confidence: 90,
      });
    }
    return evidence;
  }

  const analyzedNote = `Based on ${pages.length} analyzed page(s).`;
  /**
   * Some page the audit meant to read could not be read.
   *
   * When that happens, "we did not find X" stops being evidence that X is
   * absent — it may simply live on the page that failed. Absence claims are
   * softened and their confidence lowered rather than stated as fact.
   */
  const collectionIncomplete = failures.length > 0;

  // Business identity
  if (home.title) {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'BUSINESS_IDENTITY',
      fact: `Homepage title: "${home.title.slice(0, 120)}".`,
      supportingContext: home.metaDescription ? `Meta description: ${home.metaDescription.slice(0, 200)}` : null,
      confidence: 95,
    });
  } else {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'TECHNICAL_SIGNAL',
      fact: 'Homepage has no <title> tag, weakening search-result presentation.',
      supportingContext: null,
      confidence: 90,
    });
  }
  if (!home.metaDescription) {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'TECHNICAL_SIGNAL',
      fact: 'Homepage has no meta description; search engines will improvise the snippet.',
      supportingContext: null,
      confidence: 90,
    });
  }
  if (!home.https) {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'TECHNICAL_SIGNAL',
      fact: 'Website is served over HTTP without HTTPS, which browsers flag as not secure.',
      supportingContext: null,
      confidence: 95,
    });
  }
  if (!home.hasViewportMeta) {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'MOBILE_SIGNAL',
      fact: 'Homepage lacks a mobile viewport meta tag; mobile rendering is likely degraded.',
      supportingContext: 'No <meta name="viewport"> found in homepage HTML.',
      confidence: 85,
    });
  } else {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'MOBILE_SIGNAL',
      fact: 'Homepage declares a mobile viewport meta tag (basic mobile configuration present).',
      supportingContext: null,
      confidence: 85,
    });
  }
  if (home.hasStructuredData) {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'TECHNICAL_SIGNAL',
      fact: 'Structured data (JSON-LD or microdata) detected on the homepage.',
      supportingContext: null,
      confidence: 80,
    });
  }

  // Phone
  const anyPhone = pages.find((p) => p.phones.length > 0);
  if (anyPhone) {
    evidence.push({
      sourceUrl: anyPhone.finalUrl,
      evidenceType: 'PHONE_VISIBILITY',
      // Colon, not brackets. The number is already parenthesised by its own area
      // code, so wrapping the sentence in another pair produced "((727) 367-4588)".
      fact: `A phone number is publicly displayed: ${anyPhone.phones[0]}.`,
      supportingContext: anyPhone.finalUrl === home.finalUrl ? 'Displayed on the homepage.' : 'Displayed on a secondary page.',
      confidence: 95,
    });
    if (home.phones.length === 0) {
      evidence.push({
        sourceUrl: home.finalUrl,
        evidenceType: 'PHONE_VISIBILITY',
        fact: 'No phone number was detected on the homepage itself.',
        supportingContext: 'Customers must navigate to another page to find the number.',
        confidence: 75,
      });
    }
  } else {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'PHONE_VISIBILITY',
      fact: 'No phone number was detected on any analyzed page.',
      supportingContext: analyzedNote,
      confidence: 70,
    });
  }
  const clickToCall = pages.some((p) => p.clickToCallLinks > 0);
  evidence.push({
    sourceUrl: home.finalUrl,
    evidenceType: 'CLICK_TO_CALL',
    fact: clickToCall
      ? 'Click-to-call (tel:) links are present, enabling one-tap mobile calls.'
      : 'No click-to-call (tel:) links detected; mobile visitors must dial manually.',
    supportingContext: analyzedNote,
    confidence: clickToCall ? 95 : 80,
  });

  // ── PUBLIC CONTACT EMAIL ──────────────────────────────────────────────────
  //
  // An address the restaurant publishes so customers can write to it. The
  // collector has always extracted these; nothing consumed them, so an audit
  // could hold `leverocksgreatseafood@gmail.com` and still print "no published
  // email was detected". Surfacing it here makes the address traceable AND
  // gives CONTACT_PATH a single fact to agree with, so the two can no longer
  // contradict each other.
  const contactEmails = new Map<string, string>();
  for (const page of pages) {
    for (const address of page.emails ?? []) {
      const normalized = address.trim().toLowerCase();
      if (!normalized || isNonContactAddress(normalized)) continue;
      if (!contactEmails.has(normalized)) contactEmails.set(normalized, page.finalUrl);
    }
  }
  const publishedEmail = contactEmails.size > 0 ? Array.from(contactEmails.entries())[0] : null;
  if (publishedEmail) {
    const [address, foundOn] = publishedEmail;
    evidence.push({
      sourceUrl: foundOn,
      evidenceType: 'CONTACT_EMAIL',
      fact: `A public contact email address is published: ${address}.`,
      supportingContext:
        `Found on ${foundOn}.${contactEmails.size > 1 ? ` ${contactEmails.size} public address(es) were found in total.` : ''} ` +
        'This is an address the restaurant publishes for customers to write to — it is not a newsletter signup, ' +
        'which is recorded separately.',
      confidence: 90,
    });
  } else {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'CONTACT_EMAIL',
      fact: absenceClaim('No public contact email address', collectionIncomplete),
      supportingContext: collectionIncomplete
        ? `${analyzedNote} ${INCOMPLETE_COLLECTION_CAVEAT}`
        : analyzedNote,
      confidence: collectionIncomplete ? 45 : 65,
    });
  }

  // ── CUSTOMER-FACING FORMS ─────────────────────────────────────────────────
  //
  // A form is a route in. The collector read the forms on every page and then
  // discarded them (`void formsHtml`), so a restaurant serving a contact form
  // was still told no enquiry form existed — the same false negative as the
  // discarded email address, reached the same way.
  const contactFormPage = pages.find((p) => p.contactFormSignal);
  const reservationFormPage = pages.find((p) => p.reservationFormSignal);
  if (contactFormPage) {
    evidence.push({
      sourceUrl: contactFormPage.finalUrl,
      evidenceType: 'CONTACT_FORM',
      fact: 'A customer enquiry form is published on the website.',
      supportingContext:
        `Found on ${contactFormPage.finalUrl}. The form's own wording or attributes invite general enquiries, so a ` +
        'visitor can write to the restaurant without calling. The form was not submitted during this audit: ' +
        'whether the submission reaches anyone, and how quickly it is answered, cannot be observed from a public page ' +
        'and needs owner confirmation. This is not a newsletter signup, which is recorded separately.',
      confidence: 85,
    });
  }
  if (reservationFormPage) {
    evidence.push({
      sourceUrl: reservationFormPage.finalUrl,
      evidenceType: 'RESERVATION_PATH',
      // Carefully bounded: a request form is not a booking system. The wording
      // deliberately avoids the "pathway is publicly linked" phrasing that
      // downstream layers read as a working, tested pathway.
      fact: 'A table-request form is published on the website, but whether it reaches a booking system could not be verified.',
      supportingContext:
        `Found on ${reservationFormPage.finalUrl}. The form collects a booking request — date, time or party size. ` +
        'Submitting it is not the same as holding a table: whether anyone receives the request, how fast it is answered, ' +
        'and whether the guest gets a confirmation all require owner data. Manual validation required.',
      confidence: 70,
    });
  }

  // A FORM WITH ONE PURPOSE IS NOT A GENERAL ENQUIRY ROUTE.
  //
  // The gift-card page serves a form with a message box. Classifying it as a
  // contact form said a guest could write in about anything; ignoring it said
  // the page had no form at all. Both are wrong, so the scope is reported.
  const scopedForms = new Map<string, string>();
  for (const page of pages) {
    for (const scope of page.formScopes ?? []) {
      if (!scopedForms.has(scope)) scopedForms.set(scope, page.finalUrl);
    }
  }
  for (const [scope, foundOn] of scopedForms) {
    evidence.push({
      sourceUrl: foundOn,
      evidenceType: 'SINGLE_PURPOSE_FORM',
      fact: `A ${scope} form is published on the website; its own wording scopes it to ${scope} requests, not general enquiries.`,
      supportingContext:
        `Found on ${foundOn}. The form's own wording names ${scope} requests and does not invite general enquiries, so ` +
        'it is not counted as a way for a guest to ask the restaurant a general question. Whether the restaurant also ' +
        'accepts general enquiries through it is not observable from a public page and needs owner confirmation. ' +
        'The form was not submitted during this audit.',
      confidence: 75,
    });
  }

  // A FORM WHOSE PURPOSE IS NOT ESTABLISHED IS REPORTED AS EXACTLY THAT.
  //
  // A message box alone does not show that a form takes general enquiries —
  // gift-card, job and catering forms all carry one. Counting such a form as a
  // contact route claimed a capability nobody observed; ignoring it let the
  // audit say no route existed on a page serving a form. It is neither.
  const unverifiedForms = pages.flatMap((p) => (p.unverifiedForms ?? []).map((f) => ({ ...f, foundOn: p.finalUrl })));
  if (unverifiedForms.length > 0) {
    const first = unverifiedForms[0];
    const reasons = Array.from(new Set(unverifiedForms.map((f) => unverifiedReasonText(f))));
    evidence.push({
      sourceUrl: first.foundOn,
      evidenceType: 'FORM_PURPOSE_UNVERIFIED',
      fact:
        'A form a customer can write into is published on the website, but whether it accepts general enquiries ' +
        'could not be established from the form itself.',
      supportingContext:
        `Found on ${first.foundOn}${unverifiedForms.length > 1 ? ` (${unverifiedForms.length} such forms in total)` : ''}. ` +
        `${reasons.join(' ')} ` +
        'It is not counted as a verified contact route, and it is not evidence that no route exists. ' +
        'The form was not submitted during this audit. Owner confirmation required.',
      confidence: 50,
    });
  }

  // Hours & address
  const hoursPage = pages.find((p) => p.hoursText);
  evidence.push({
    sourceUrl: hoursPage?.finalUrl ?? home.finalUrl,
    evidenceType: 'HOURS_VISIBILITY',
    fact: hoursPage
      ? 'Business hours are published on the website.'
      : 'Business hours were not detected in the text of the analyzed pages.',
    supportingContext: hoursPage
      ? `Detected hours text: "${normalizePhonesInText(hoursPage.hoursText as string)}"`
      : analyzedNote,
    confidence: hoursPage ? 90 : 60,
  });
  const addressPage = pages.find((p) => p.addressText);
  evidence.push({
    sourceUrl: addressPage?.finalUrl ?? home.finalUrl,
    evidenceType: 'ADDRESS_VISIBILITY',
    fact: addressPage
      ? 'A street address is published on the website.'
      : 'A street address was not detected in the text of the analyzed pages.',
    supportingContext: addressPage
      ? `Detected address text: "${normalizePhonesInText(addressPage.addressText as string)}"`
      : analyzedNote,
    confidence: addressPage ? 90 : 60,
  });

  // Vendor/builder credits: recorded as a technical fact, never as a pathway.
  const credits = new Map<string, string>();
  for (const page of pages) {
    for (const c of page.vendorCredits ?? []) if (!credits.has(c.href)) credits.set(c.href, c.text);
  }
  if (credits.size > 0) {
    const [creditHref, creditText] = Array.from(credits.entries())[0];
    const vendor = detectPlatform([creditHref]) ?? hostOf(creditHref);
    evidence.push({
      sourceUrl: creditHref,
      evidenceType: 'TECHNICAL_SIGNAL',
      fact: `The website carries a builder/vendor credit for ${vendor}.`,
      supportingContext:
        `Credit link text: "${creditText}" → ${creditHref}. ` +
        'Recorded as a technical fact about who built the site. It is not a customer-facing booking or ordering pathway and is excluded from those checks.',
      confidence: 85,
    });
  }

  // Widget vendors detected from script/iframe assets, resolved per capability:
  // an OpenTable script says nothing about ordering, and a Toast script says
  // nothing about reservations.
  const allAssetHosts = pages.flatMap((p) => p.assetHosts ?? []);
  const widgetVendorFor: Record<'reservation' | 'ordering', string | null> = {
    reservation: detectWidgetVendor(allAssetHosts, 'reservation'),
    ordering: detectWidgetVendor(allAssetHosts, 'ordering'),
  };

  // Path categories -> evidence
  const pathChecks: { key: keyof PageExtract['categorizedLinks']; type: EvidenceInput['evidenceType']; label: string }[] = [
    { key: 'menu', type: 'MENU_ACCESS', label: 'menu' },
    { key: 'reservation', type: 'RESERVATION_PATH', label: 'reservation' },
    { key: 'ordering', type: 'ORDERING_PATH', label: 'online ordering' },
    { key: 'contact', type: 'CONTACT_PATH', label: 'contact' },
    { key: 'catering', type: 'CATERING_PATH', label: 'catering' },
    { key: 'private_dining', type: 'PRIVATE_DINING_PATH', label: 'private dining' },
    { key: 'faq', type: 'FAQ_SIGNAL', label: 'FAQ' },
    { key: 'gift_card', type: 'GIFT_CARD_SIGNAL', label: 'gift card' },
    { key: 'loyalty', type: 'LOYALTY_SIGNAL', label: 'loyalty or rewards' },
  ];
  // TELEPHONE PRECEDENCE.
  //
  // What a customer is actually offered outranks what a widget's configuration
  // declares. On a site whose "ORDER" button is a tel: link, the resolved
  // `/order-online/<slug>` URL sitting in the widget config is not the pathway
  // customers meet — the phone is. Reporting the config URL as functioning
  // online ordering told an owner they had something their customers cannot
  // reach, which is the exact false claim this audit exists to avoid.
  //
  // Narrow by construction: only tel: links whose wording offers to take an
  // order count, so "Call us" cannot suppress a genuine ordering pathway.
  const phoneOrderCtas = pages.flatMap((p) => p.phoneOrderCtas ?? []);
  const hasPhoneOrdering = phoneOrderCtas.length > 0;

  // Every menu destination customers are offered, judged one by one after
  // the probe results are in (see MENU AVAILABILITY below).
  let offeredMenuLinks: CategorizedLink[] = [];
  for (const check of pathChecks) {
    const found = new Map<string, CategorizedLink>();
    for (const page of pages) {
      for (const link of page.categorizedLinks[check.key] ?? []) {
        if (isTransactional(check.key) && !isCustomerReachable(link)) continue;
        if (!found.has(link.href)) found.set(link.href, link);
      }
    }
    if (check.key === 'ordering' && hasPhoneOrdering) {
      // The ordering call-to-action dials a phone. Any destination resolved
      // from markup is reported as context, never as the pathway.
      const resolved = Array.from(found.keys());
      evidence.push({
        sourceUrl: home.finalUrl,
        evidenceType: 'ORDERING_PATH',
        fact:
          'Ordering is offered by telephone: the ordering call-to-action on the website places a phone call ' +
          'rather than opening an online ordering page.',
        supportingContext:
          `Call-to-action text: ${phoneOrderCtas.slice(0, 3).map((t) => `"${t}"`).join(', ')} linked to a telephone number. ` +
          (resolved.length > 0
            ? `An ordering destination is also declared in the page markup (${resolved[0]}), but the action a customer is ` +
              'actually offered is the phone call above, so it is recorded as context rather than as a working online ' +
              'ordering pathway. Whether that destination is reachable for customers requires manual validation.'
            : 'No browser-based ordering destination was found alongside it.'),
        confidence: 85,
      });
    } else if (found.size > 0) {
      // Prefer an ordinary anchor when one exists: it is the pathway a customer
      // can see without JavaScript, and it makes the better citation.
      const links = Array.from(found.values());
      const first = links.find((l) => l.source === 'anchor') ?? links[0];
      const firstHref = first.href;
      const external = isExternal(firstHref, home.finalUrl);
      const platform = (check.key === 'reservation' || check.key === 'ordering')
        ? detectPlatform(Array.from(found.keys()))
        : null;
      const fromEmbed = first.source === 'embed';
      evidence.push({
        sourceUrl: firstHref,
        evidenceType: check.type,
        fact:
          `${indefiniteArticle(check.label)} ${check.label} pathway is publicly ` +
          `${fromEmbed ? 'reachable through an embedded widget' : 'linked'}` +
          `${platform ? ` via ${platform}` : external ? ' to an external platform' : ''} (${found.size} link(s) found).`,
        supportingContext: fromEmbed
          ? `Destination declared by an embedded widget: "${first.text || '(no text)'}" → ${firstHref}. ` +
            'The widget itself is drawn by JavaScript this audit does not execute, so how it appears on screen still needs a human look; ' +
            'the destination above is stated in the public HTML and was resolved from it.'
          : `Example link text: "${first.text || '(no text)'}" → ${firstHref}`,
        confidence: fromEmbed ? 85 : 90,
      });
      // A MENU PAGE THE AUDIT FETCHED IS A TESTED MENU PAGE.
      //
      // The orchestrator never probes a link to a page it already collected,
      // so a menu that was crawled successfully left only "publicly linked"
      // behind — indistinguishable from a link nobody tested. Recording the
      // successful fetch keeps "verified" and "unknown" apart downstream; the
      // placeholder check matches the probe path's.
      if (check.key === 'menu') {
        offeredMenuLinks = links;
        // Exact destinations only: /menu and /menu/ are different addresses
        // unless the fetch itself redirected between them (requestedUrl vs
        // finalUrl), which is the one observed equivalence.
        const sameUrl = (a: string, b: string) => destinationKey(a) === destinationKey(b);
        const fetched = pages.find(
          (p) =>
            p.httpStatus >= 200 &&
            p.httpStatus < 300 &&
            links.some((l) => sameUrl(l.href, p.finalUrl) || sameUrl(l.href, p.requestedUrl)),
        );
        if (fetched) {
          const placeholder = fetched.menuPlaceholderSignal;
          evidence.push(
            placeholder
              ? {
                  sourceUrl: fetched.finalUrl,
                  evidenceType: 'MENU_ACCESS',
                  fact: `The linked menu destination is reachable but has no menu published on it yet (fetched during this audit, HTTP ${fetched.httpStatus}).`,
                  supportingContext: `${fetched.finalUrl}. Signal read from the page — ${placeholder}. Customers who follow the menu link do not find a menu.`,
                  confidence: 85,
                }
              : {
                  sourceUrl: fetched.finalUrl,
                  evidenceType: 'MENU_ACCESS',
                  fact: `The linked menu page was fetched successfully during this audit (HTTP ${fetched.httpStatus}).`,
                  supportingContext:
                    `${fetched.finalUrl}. Collected as one of the audit's source pages, so it was not probed separately. ` +
                    'This confirms the page loads; whether it shows a complete, current menu is not assessed.',
                  confidence: 85,
                },
          );
        }
      }
      if (check.key === 'ordering' && found.size >= 3) {
        const hosts = new Set(Array.from(found.keys()).map(hostOf));
        if (hosts.size >= 3) {
          evidence.push({
            sourceUrl: home.finalUrl,
            evidenceType: 'ORDERING_PATH',
            fact: `Multiple competing ordering destinations detected across ${hosts.size} different platforms.`,
            supportingContext: `Hosts: ${Array.from(hosts).slice(0, 5).join(', ')}`,
            confidence: 80,
          });
        }
      }
    } else if ((check.key === 'reservation' || check.key === 'ordering') && widgetVendorFor[check.key]) {
      // A vendor's widget is on the page but no anchor was found: its
      // destination is rendered by JavaScript we do not execute. This is NOT a
      // working pathway and must never read as one — it is an explicit unknown
      // with the reason attached, so the gap can be validated by hand.
      evidence.push({
        sourceUrl: home.finalUrl,
        evidenceType: check.type,
        fact: `No public ${check.label} pathway could be resolved, but a ${widgetVendorFor[check.key]} widget was detected on the page.`,
        supportingContext:
          `${widgetVendorFor[check.key]} assets are loaded by the site, so a ${check.label} option may be presented to customers by a script. ` +
          'Its destination is rendered in the browser and cannot be verified from the public HTML — manual validation required. ' +
          'This is not evidence that a working pathway exists.',
        confidence: 55,
      });
    } else if (check.key === 'contact' && (anyPhone || clickToCall || publishedEmail || contactFormPage)) {
      // A PHONE NUMBER IS A CONTACT PATHWAY. SO IS A PUBLISHED EMAIL ADDRESS.
      //
      // The audit first reported "No public contact pathway was detected" on a
      // site that publishes its number. That was corrected — but the correction
      // then asserted that no "published email" existed, while the collector was
      // holding one it had extracted and discarded. Saying a restaurant cannot
      // be written to when it plainly can is the same error wearing a new
      // sentence, and it costs the report its credibility just as fast.
      //
      // The statement is now assembled from the routes actually found, so it
      // cannot deny one the audit has already recorded as CONTACT_EMAIL.
      //
      // PHRASING IS A CONTRACT HERE. journey.ts keys its CONTACT=FRICTION
      // branch off the literal "no non-phone contact route", so that phrase has
      // to survive verbatim in the phone-only case. The published-email case
      // gets its own sentence instead of being bent into that one — there IS a
      // non-phone route, so claiming otherwise is the defect being fixed.
      const routes: string[] = [];
      if (anyPhone || clickToCall) routes.push('telephone');
      if (publishedEmail) routes.push('a published email address');
      if (contactFormPage) routes.push('an enquiry form');
      const writtenRoute = publishedEmail || contactFormPage;
      const incompleteSuffix = collectionIncomplete ? ' on the pages that could be collected' : '';
      // A form of unverified purpose is neither a route nor the absence of
      // one, so neither sentence may treat it as either. The phone-only
      // sentence in particular must not say "no non-phone contact route" —
      // journey.ts reads that phrase as "the phone is the only route in".
      const unverifiedNote = ', and a form was found whose purpose could not be established';
      evidence.push({
        sourceUrl: home.finalUrl,
        evidenceType: 'CONTACT_PATH',
        fact: writtenRoute
          ? `A contact pathway is publicly available by ${joinRoutes(routes)}${
              contactFormPage
                ? ''
                : unverifiedForms.length > 0
                  ? `, but no contact page or verified enquiry form was detected${incompleteSuffix}${unverifiedNote}`
                  : ', but no contact page or enquiry form was detected' + incompleteSuffix
            }.`
          : unverifiedForms.length > 0
            ? `A contact pathway is publicly available by telephone; no verified non-phone contact route was ` +
              `detected${incompleteSuffix}${unverifiedNote}.`
            : `A contact pathway is publicly available by telephone, but no non-phone contact route ` +
              `(contact page, enquiry form, or published email address) was detected${incompleteSuffix}.`,
        supportingContext:
          `${anyPhone ? `Phone number published: ${anyPhone.phones[0]}. ` : ''}` +
          `${clickToCall ? 'Click-to-call (tel:) links are present. ' : ''}` +
          `${publishedEmail ? `Public email address published: ${publishedEmail[0]}. ` : ''}` +
          `${contactFormPage ? `Enquiry form published on ${contactFormPage.finalUrl}. ` : ''}` +
          // Named so the reader can see the audit found these and decided they
          // are not general enquiry routes, rather than appearing to have
          // missed a form that is plainly on the page.
          `${scopedForms.size > 0 ? `Also found, and not counted as general enquiry routes: ${joinRoutes(Array.from(scopedForms.keys()).map((s) => `a ${s} form`))}. ` : ''}` +
          `${unverifiedForms.length > 0 ? `${unverifiedForms.length} form(s) whose purpose could not be established are recorded separately and are not counted as routes. ` : ''}` +
          (writtenRoute
            ? 'Customers can reach the restaurant by phone or in writing; what happens to a written enquiry, and how fast, is not observable from the public site. '
            : unverifiedForms.length > 0
              // The form may be a written route. Saying every enquiry must
              // become a call would deny what FORM_PURPOSE_UNVERIFIED leaves open.
              ? 'Customers can reach the restaurant by phone. A form on the site may also accept written enquiries, but its ' +
                'purpose could not be established, so whether questions can reach the restaurant outside service hours ' +
                'needs owner confirmation. '
              : 'Customers can reach the restaurant; every enquiry has to become a phone call, so questions that arrive outside service hours have nowhere to go. ') +
          analyzedNote +
          (collectionIncomplete ? ` ${INCOMPLETE_COLLECTION_CAVEAT}` : ''),
        confidence: 85,
      });
    } else if (check.key === 'reservation' && reservationFormPage) {
      // A table-request form was already recorded above. Emitting "no public
      // reservation pathway was detected" as well would put two contradictory
      // sentences in the same evidence chain — and the report and the PDF print
      // the whole chain, so the client reads both. The form record IS the
      // statement about this pathway; it is bounded, and it stands alone.
    } else if (check.key === 'contact' && (unverifiedForms.length > 0 || scopedForms.size > 0)) {
      // No verified route — but the page serves a form, so "No public contact
      // pathway was detected" would deny something the audit just recorded.
      // The sentence says what is missing (a VERIFIED or GENERAL route) and
      // names what was found instead.
      evidence.push({
        sourceUrl: home.finalUrl,
        evidenceType: check.type,
        fact:
          unverifiedForms.length > 0
            ? 'No verified public contact pathway was detected; a form was found whose purpose could not be established.'
            : `No general public contact pathway was detected; ${
                scopedForms.size === 1 ? 'the only form found is' : 'the forms found are'
              } scoped to ${joinRoutes(Array.from(scopedForms.keys()).map((s) => `${s} requests`))}.`,
        supportingContext:
          `${scopedForms.size > 0 ? `Also found, and not counted as general enquiry routes: ${joinRoutes(Array.from(scopedForms.keys()).map((s) => `a ${s} form`))}. ` : ''}` +
          `${unverifiedForms.length > 0 ? 'The form of unverified purpose is recorded separately; whether it accepts general enquiries needs owner confirmation. ' : ''}` +
          analyzedNote,
        confidence: 60,
      });
    } else {
      evidence.push({
        sourceUrl: home.finalUrl,
        evidenceType: check.type,
        fact: `No public ${check.label} pathway was detected on the analyzed website pages.`,
        supportingContext: analyzedNote,
        confidence: 65,
      });
    }
  }

  // ── ORDERING CHANNEL ──────────────────────────────────────────────────────
  //
  // The canonical statement of how this restaurant takes orders, written as a
  // machine-readable token so every downstream layer reads the same decision
  // instead of re-deriving one from prose. Phone ordering is a real ordering
  // pathway and is NOT online ordering; a vendor URL that returned 404 is not
  // an ordering failure unless a customer is actually offered it.
  {
    const orderingLinks = new Map<string, CategorizedLink>();
    for (const page of pages) {
      for (const link of page.categorizedLinks.ordering ?? []) {
        if (!isCustomerReachable(link)) continue;
        if (!orderingLinks.has(link.href)) orderingLinks.set(link.href, link);
      }
    }
    // EXPOSURE MEANS A VISIBLE ANCHOR, NOT A URL IN THE MARKUP.
    //
    // `source: 'anchor'` is a link a visitor can see and tap. `source: 'embed'`
    // is a destination the audit READ OUT of an iframe, a data-attribute or an
    // inline widget config — it proves the URL is written on the page, never
    // that anyone is offered it. Stale slugs left over from a redesign live
    // there too.
    //
    // Treating an embed destination as exposed is what let a URL nobody clicks
    // become a "customer-facing failed transaction link". Only anchors count;
    // embeds stay unverified until customer exposure is actually proven.
    const visibleAnchors = new Map<string, CategorizedLink>();
    for (const [href, link] of orderingLinks) {
      if (link.source === 'anchor') visibleAnchors.set(href, link);
    }
    const exposedUrls = new Set(visibleAnchors.keys());
    const destinations: OrderingDestination[] = Array.from(orderingLinks.entries()).map(([url, link]) => ({
      url,
      exposedInCustomerJourney: link.source === 'anchor',
      platform: detectPlatform([url]),
      host: hostOf(url),
      // Provenance: the visible call-to-action that leads here, when there is one.
      ctaText: link.source === 'anchor' ? link.text || '(no link text)' : null,
      discoveredVia: link.source === 'anchor' ? 'VISIBLE_LINK' : 'PAGE_MARKUP',
    }));

    const orderingProbes: OrderingProbe[] = [];
    for (const probe of probes) {
      if (probe.category !== 'ordering') continue;
      const exposed =
        probe.exposedInCustomerJourney ?? (exposedUrls.has(probe.url) || (probe.finalUrl ? exposedUrls.has(probe.finalUrl) : false));
      if (!exposed && !destinations.some((d) => d.url === probe.url)) {
        destinations.push({
          url: probe.url,
          exposedInCustomerJourney: false,
          platform: detectPlatform([probe.finalUrl ?? probe.url]),
          host: hostOf(probe.finalUrl ?? probe.url),
        });
      }
      orderingProbes.push({
        url: probe.url,
        finalUrl: probe.finalUrl,
        ok: probe.ok,
        httpStatus: probe.httpStatus,
        failureKind: probe.failureKind,
        disabledSignal: probe.disabledSignal,
        exposedInCustomerJourney: exposed,
      });
    }

    const channel = resolveOrderingChannel({
      phoneOrderCtas,
      destinations,
      probes: orderingProbes,
      widgetVendor: widgetVendorFor.ordering,
    });
    evidence.push({
      sourceUrl: destinations.find((d) => d.exposedInCustomerJourney)?.url ?? home.finalUrl,
      evidenceType: 'ORDERING_CHANNEL',
      fact: formatOrderingChannelFact(channel),
      supportingContext: `${channel.detail} Evidence confidence: ${channel.evidenceState}.`,
      confidence: channel.evidenceState === 'VERIFIED' ? 90 : channel.evidenceState === 'STRONG_EVIDENCE' ? 75 : 55,
    });
  }

  // Menu format
  const menuLinks = pages.flatMap((p) => p.categorizedLinks.menu ?? []);
  const pdfMenu = menuLinks.filter((l) => /\.pdf(\?|$)/i.test(l.href));
  if (pdfMenu.length > 0 && pdfMenu.length === new Set(menuLinks.map((l) => l.href)).size) {
    evidence.push({
      sourceUrl: pdfMenu[0].href,
      evidenceType: 'MENU_ACCESS',
      fact: 'The only detected menu links point to PDF files, which create friction on mobile devices.',
      supportingContext: pdfMenu[0].href,
      confidence: 80,
    });
  } else if (pdfMenu.length > 0) {
    evidence.push({
      sourceUrl: pdfMenu[0].href,
      evidenceType: 'MENU_ACCESS',
      fact: 'Some menu links point to PDF files.',
      supportingContext: pdfMenu[0].href,
      confidence: 80,
    });
  }

  // Retention signals
  const emailCapture = pages.some((p) => p.emailCaptureSignal);
  // A signup form that does not say it adds visitors to a list is reported as
  // exactly that — not as capture, and not as "no mechanism was detected".
  const unverifiedSignupPage = emailCapture ? undefined : pages.find((p) => p.unverifiedSignupSignal);
  const smsCapture = pages.some((p) => p.smsCaptureSignal);
  evidence.push({
    sourceUrl: unverifiedSignupPage?.finalUrl ?? home.finalUrl,
    evidenceType: 'EMAIL_CAPTURE',
    // About collecting the VISITOR's address, not publishing the restaurant's.
    // CONTACT_EMAIL covers the latter; keeping the two apart is what stops a
    // newsletter box being read as a contact route, or its absence being read
    // as "there is no way to email them".
    fact: emailCapture
      ? "An email capture mechanism for collecting visitors' addresses (signup form or newsletter invitation) is publicly visible."
      : unverifiedSignupPage
        ? UNVERIFIED_SIGNUP_FACT
        : "No mechanism for collecting visitors' email addresses (signup form or newsletter invitation) was detected on the analyzed pages.",
    supportingContext: unverifiedSignupPage
      ? `Found on ${unverifiedSignupPage.finalUrl}. The form collects an email address and its button reads like a signup, ` +
        'but nothing in the form says it subscribes visitors to a newsletter, mailing list or offers. It is not counted as ' +
        'email capture, and it is not evidence that none exists. Owner confirmation required. ' +
        `${analyzedNote} This concerns list building, not the restaurant's own published contact address.`
      : `${analyzedNote} This concerns list building, not the restaurant's own published contact address.`,
    confidence: emailCapture ? 85 : unverifiedSignupPage ? 50 : 65,
  });
  if (smsCapture) {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'SMS_CAPTURE',
      fact: 'An SMS/text club signup signal is publicly visible.',
      supportingContext: analyzedNote,
      confidence: 80,
    });
  }

  // Social
  const social = new Set(pages.flatMap((p) => p.socialLinks));
  evidence.push({
    sourceUrl: home.finalUrl,
    evidenceType: 'SOCIAL_LINK',
    fact: social.size > 0
      ? `${social.size} social profile link(s) detected.`
      : 'No social profile links were detected on the analyzed pages.',
    supportingContext: social.size > 0 ? Array.from(social).slice(0, 5).join(', ') : analyzedNote,
    confidence: social.size > 0 ? 90 : 60,
  });

  // CTAs
  const homeCtas = home.ctas;
  evidence.push({
    sourceUrl: home.finalUrl,
    evidenceType: 'CTA_SIGNAL',
    fact: homeCtas.length > 0
      ? `Homepage presents ${homeCtas.length} action-oriented CTA(s).`
      : 'No clear action-oriented CTAs (order, reserve, call, menu) were detected on the homepage.',
    supportingContext: homeCtas.length > 0 ? `Examples: ${normalizePhonesInText(homeCtas.slice(0, 6).join(' | '))}` : null,
    confidence: 80,
  });
  if (homeCtas.length > 8) {
    // COUNTING IS NOT SEEING.
    //
    // This used to read "N competing CTAs, which can dilute the primary next
    // action" — one sentence containing a count that was observed and a
    // usability verdict that was not. The audit reads markup, not layout: it
    // cannot see size, position, contrast or visual hierarchy, so it cannot
    // know whether these actions compete with each other or sit in a perfectly
    // clear order. The count stays; the verdict becomes an explicit question.
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'CTA_SIGNAL',
      fact: `Homepage presents ${homeCtas.length} distinct action-oriented CTAs, more than the 8 this audit treats as a prompt to look at hierarchy.`,
      supportingContext:
        `${normalizePhonesInText(homeCtas.slice(0, 10).join(' | '))}. ` +
        'This is a COUNT, not a judgement about the design. Whether these actions compete visually depends on layout, ' +
        'size and placement, which this audit does not render or measure, and whether any conversion is lost depends on ' +
        'website analytics it cannot see.',
      confidence: 70,
    });
  }

  // Destinations that exist ONLY as page markup — an iframe src, a data
  // attribute, an inline widget config — with no visible anchor anywhere
  // pointing at them.
  //
  // A URL in this set is written on the page and offered to nobody. It cannot
  // become a customer-facing failed transaction link however it responds, which
  // is the rule the probe loop below enforces. Anchors win: a URL that appears
  // both as an embed and as a real link is a real link.
  const anchorUrls = new Set<string>();
  const embedUrls = new Set<string>();
  for (const page of pages) {
    for (const links of Object.values(page.categorizedLinks)) {
      for (const link of links ?? []) {
        (link.source === 'anchor' ? anchorUrls : embedUrls).add(link.href);
      }
    }
  }
  const markupOnly = (url: string | undefined) => Boolean(url) && embedUrls.has(url as string) && !anchorUrls.has(url as string);

  // Probes (broken links)
  //
  // Every probe's outcome is also recorded against its own URL, so MENU
  // AVAILABILITY can judge every menu link on its own. Keyed by URL, not by
  // the category that scheduled the probe: a "View Menu and Order" link is
  // both menu and ordering, the orchestrator probes it once — as ordering —
  // and that observation was being thrown away for the menu.
  const menuProbeOutcome = new Map<string, { status: MenuDestinationStatus; note: string }>();
  // Outcomes reached by FOLLOWING a redirect: the probe of /menu that landed
  // on /menu/ observed /menu/ too. Used only for a destination nobody probed
  // directly, so an observed redirect is the one thing that joins two
  // addresses, and a direct probe always outranks it.
  const menuRedirectOutcome = new Map<string, { status: MenuDestinationStatus; note: string }>();
  const noteMenu = (probe: ProbeResult, status: MenuDestinationStatus) => {
    const outcome = { status, note: probe.category === 'menu' ? probe.note : `${probe.note}, tested as the ${probe.category} destination` };
    menuProbeOutcome.set(destinationKey(probe.url), outcome);
    if (probe.finalUrl && destinationKey(probe.finalUrl) !== destinationKey(probe.url)) {
      menuRedirectOutcome.set(destinationKey(probe.finalUrl), { status, note: `${probe.note}, reached by redirect from ${probe.url}` });
    }
  };
  for (const probe of probes) {
    const target = probe.finalUrl ?? probe.url;
    // Explicit flag wins; otherwise a destination is assumed exposed unless it
    // is demonstrably markup-only. Defaulting to exposed keeps every genuine
    // discovered-link failure reporting exactly as before.
    const exposed = probe.exposedInCustomerJourney ?? !(markupOnly(probe.url) || markupOnly(probe.finalUrl));
    const destination = classifyDestination(target);
    const kind = probe.destinationKind ?? destination.kind;

    // ── NOT A CUSTOMER DESTINATION ────────────────────────────────────────
    //
    // An API endpoint, a static asset or an unparseable target is not somewhere
    // a customer is ever sent, so nothing it returns can demonstrate anything
    // about the customer journey. The raw result is preserved as a technical
    // signal for debugging — that is what "preserve the raw evidence" means —
    // and it is kept out of BROKEN_LINK entirely, because BROKEN_LINK is what
    // the journey and the leak rules read to declare a dead end.
    if (kind !== 'CUSTOMER_FACING') {
      noteMenu(probe, 'unverified');
      evidence.push({
        sourceUrl: probe.url,
        evidenceType: 'TECHNICAL_SIGNAL',
        fact:
          // "An" before a vowel: the category is interpolated, so "A ordering
          // endpoint" reached the client PDF. Cheap to get right, and a
          // grammatical slip on a page of careful claims costs credibility.
          `${/^[aeiou]/i.test(probe.category) ? 'An' : 'A'} ${probe.category} endpoint referenced by the site was ` +
          `tested and is not a customer-facing destination (${probe.note}).`,
        supportingContext:
          `${probe.url}${probe.finalUrl && probe.finalUrl !== probe.url ? ` → ${probe.finalUrl}` : ''}. ` +
          `Classified as ${kind} — ${destination.reason}. ` +
          'Raw result retained for debugging. It is deliberately excluded from the customer-journey assessment: no ' +
          'customer opens this URL, so its response says nothing about whether the pathway works or fails.',
        confidence: 85,
      });
      continue;
    }

    // ── METHOD SEMANTICS ──────────────────────────────────────────────────
    //
    // 405/501 on a customer-facing URL still describes the request method, not
    // the resource. The destination answered — it simply refused GET. This is
    // an explicit unknown, never a failure.
    if (isMethodSemanticsRefusal(probe.httpStatus)) {
      noteMenu(probe, 'unverified');
      evidence.push({
        sourceUrl: probe.url,
        evidenceType:
          probe.category === 'reservation' ? 'RESERVATION_PATH' : probe.category === 'ordering' ? 'ORDERING_PATH' : 'MENU_ACCESS',
        fact:
          `The ${probe.category} destination exists but could not be verified from the public page ` +
          `(HTTP ${probe.httpStatus} Method Not Allowed) — manual validation required.`,
        supportingContext:
          `${probe.url}${probe.finalUrl && probe.finalUrl !== probe.url ? ` → ${probe.finalUrl}` : ''}. ` +
          `HTTP ${probe.httpStatus} means the server understood the address and rejected the audit's GET request. ` +
          'That confirms the destination is live and tells us nothing about whether a customer can complete the ' +
          'action, so it is recorded as unverified rather than as a failure.',
        confidence: 60,
      });
      continue;
    }

    if (!probe.ok) {
      const verdict = exposed
        ? mayClaimVerifiedBroken(probe)
        : {
            allowed: false,
            reason:
              'the destination appears only in the page markup — no visible link or button points customers to it, ' +
              'so nothing here shows a customer ever reaches it',
          };
      if (!verdict.allowed) {
        noteMenu(probe, 'unverified');
        // Reached only for an audit-side limitation — a timeout, or the SSRF
        // policy declining to follow. Recorded honestly as unresolved.
        evidence.push({
          sourceUrl: probe.url,
          evidenceType:
            probe.category === 'reservation' ? 'RESERVATION_PATH' : probe.category === 'ordering' ? 'ORDERING_PATH' : 'MENU_ACCESS',
          fact: `The ${probe.category} destination could not be verified when tested (${probe.note}) — manual validation required.`,
          supportingContext: `${probe.url}. Not reported as a failure because ${verdict.reason}.`,
          confidence: 55,
        });
        continue;
      }
      noteMenu(probe, 'failed');
      evidence.push({
        sourceUrl: probe.url,
        evidenceType: 'BROKEN_LINK',
        fact: `The linked ${probe.category} destination failed when tested (${probe.note}).`,
        supportingContext: `${probe.url}. Verified as a customer-facing failure: ${verdict.reason}.`,
        confidence: probe.httpStatus ? 95 : 75,
      });
    } else {
      // Name the destination actually reached, and the vendor operating it —
      // "where does this button lead" is the question the audit is answering.
      const resolved = probe.finalUrl && probe.finalUrl !== probe.url ? probe.finalUrl : null;
      const operator = detectPlatform([probe.finalUrl ?? probe.url]);
      const evidenceType =
        probe.category === 'reservation' ? 'RESERVATION_PATH' : probe.category === 'ordering' ? 'ORDERING_PATH' : 'MENU_ACCESS';

      if (probe.disabledSignal && (probe.category === 'reservation' || probe.category === 'ordering')) {
        // The page says the service is off. Whether it still shows a menu is
        // not established, so a menu on the same URL stays unverified.
        noteMenu(probe, probe.placeholderSignal ? 'placeholder' : 'unverified');
        // The destination itself says the service is off. A 200 response with
        // bookings closed is not a working pathway, and reporting it as one was
        // the false claim this branch exists to prevent.
        evidence.push({
          sourceUrl: probe.url,
          evidenceType,
          fact: `The linked ${probe.category} destination is reachable but states the service is unavailable (${probe.note}).`,
          supportingContext:
            `${resolved ? `${probe.url} → resolves to ${resolved}. ` : `${probe.url}. `}` +
            `Signal read from the destination page — ${probe.disabledSignal}. ` +
            'Customers arriving here cannot complete the action.',
          confidence: 90,
        });
      } else if (probe.category === 'reservation' || probe.category === 'ordering') {
        // A menu is read, not transacted: the page loading is all a menu needs.
        // The ordering claim below stays exactly as bounded as before — this
        // says nothing about whether an order can be placed. An
        // access-restricted answer is not the page loading: the audit never
        // saw it, so a menu on the same URL stays unverified.
        noteMenu(probe, isAccessRestricted(probe) ? 'unverified' : probe.placeholderSignal ? 'placeholder' : 'working');
        // Reservations and ordering are transactions the business can switch
        // off, so a 200 says the page exists and nothing about whether the
        // customer can complete the action.
        const action = probe.category === 'reservation' ? 'complete a booking' : 'place an order';
        const service = probe.category === 'reservation' ? 'bookings are' : 'orders are';
        const offState = probe.category === 'reservation' ? 'reservations switched off' : 'ordering switched off';
        evidence.push({
          sourceUrl: probe.url,
          evidenceType,
          fact:
            `The linked ${probe.category} destination is reachable, but whether a customer can ${action} ` +
            `was not verified (${probe.note})` +
            `${operator ? ` — operated by ${operator}` : ''}.`,
          supportingContext:
            `${resolved ? `${probe.url} → resolves to ${resolved}. ` : `${probe.url}. `}` +
            `The destination responded, which confirms it exists and is reachable. It does not confirm that ${service} ` +
            `being accepted — a page with ${offState} responds identically. Manual validation required.`,
          confidence: 80,
        });
      } else if (probe.category === 'menu' && isAccessRestricted(probe)) {
        // 401/403/429: the server answered and would not show the page.
        // Reachable, never verified — the audit did not see a menu.
        noteMenu(probe, 'unverified');
        evidence.push({
          sourceUrl: probe.url,
          evidenceType,
          fact: `The menu destination could not be verified when tested (HTTP ${probe.httpStatus}, access restricted) — manual validation required.`,
          supportingContext:
            `${resolved ? `${probe.url} → resolves to ${resolved}. ` : `${probe.url}. `}` +
            `${probe.note}. The server answered but refused to show the page, so whether it shows a menu was not observed. ` +
            'It is not reported as working, and not as broken.',
          confidence: 55,
        });
      } else if (probe.category === 'menu' && probe.placeholderSignal) {
        noteMenu(probe, 'placeholder');
        // A menu is read, not transacted, so a reachable menu stays healthy.
        // The one real failure is a page that loads with no menu on it yet.
        evidence.push({
          sourceUrl: probe.url,
          evidenceType,
          fact: `The linked menu destination is reachable but has no menu published on it yet (${probe.note}).`,
          supportingContext:
            `${resolved ? `${probe.url} → resolves to ${resolved}. ` : `${probe.url}. `}` +
            `Signal read from the destination page — ${probe.placeholderSignal}. ` +
            'Customers who follow the menu link do not find a menu.',
          confidence: 85,
        });
      } else {
        noteMenu(probe, 'working');
        evidence.push({
          sourceUrl: probe.url,
          evidenceType,
          fact:
            `The linked ${probe.category} destination responded successfully when tested (${probe.note})` +
            `${operator ? ` and is operated by ${operator}` : ''}.`,
          supportingContext: resolved ? `${probe.url} → resolves to ${resolved}` : probe.url,
          confidence: 90,
        });
      }
    }
  }

  // ── MENU AVAILABILITY ─────────────────────────────────────────────────────
  //
  // ONE CONCLUSION, FROM EVERY MENU DESTINATION JUDGED ON ITS OWN.
  //
  // Menu results used to be read as a pile of records, so one broken spare
  // link cancelled a verified working menu: a site with HTTP 200 at /menu and
  // 404 at /old-menu was told "the menu cannot be read online". Each linked
  // destination now gets its own status from its own probe or fetch:
  //   working      responded successfully, or fetched as a source page;
  //   failed       verified broken;
  //   placeholder  loads, but has no menu on it yet;
  //   unverified   not tested, refused the audit's request, or timed out.
  // Any working destination answers the menu question. With none working, an
  // unverified one keeps the answer open; only when every destination failed
  // is there no readable menu. Destinations are sorted by URL, so the
  // conclusion and its citation do not depend on link order.
  if (offeredMenuLinks.length > 0) {
    const fetchedMenu = (key: string) =>
      pages.find(
        (p) =>
          p.httpStatus >= 200 &&
          p.httpStatus < 300 &&
          (destinationKey(p.finalUrl) === key || destinationKey(p.requestedUrl) === key),
      );
    const destinations = new Map<string, { url: string; status: MenuDestinationStatus; note: string }>();
    for (const link of offeredMenuLinks) {
      const key = destinationKey(link.href);
      if (destinations.has(key)) continue;
      const probed = menuProbeOutcome.get(key) ?? menuRedirectOutcome.get(key);
      const fetched = probed ? undefined : fetchedMenu(key);
      destinations.set(
        key,
        probed
          ? { url: link.href, ...probed }
          : fetched
            ? fetched.menuPlaceholderSignal
              ? { url: link.href, status: 'placeholder', note: `fetched during this audit, HTTP ${fetched.httpStatus}` }
              : { url: link.href, status: 'working', note: `fetched during this audit, HTTP ${fetched.httpStatus}` }
            : { url: link.href, status: 'unverified', note: 'not tested' },
      );
    }
    const all = Array.from(destinations.values()).sort((a, b) => a.url.localeCompare(b.url));
    const working = all.filter((d) => d.status === 'working');
    const failed = all.filter((d) => d.status === 'failed' || d.status === 'placeholder');
    const unverified = all.filter((d) => d.status === 'unverified');
    const LABEL: Record<MenuDestinationStatus, string> = {
      working: 'works',
      failed: 'failed when tested',
      placeholder: 'loads but has no menu published on it yet',
      unverified: 'not verified',
    };
    const others = [
      failed.length > 0 ? `${failed.length} other menu link(s) failed when tested or have no menu yet` : '',
      unverified.length > 0 ? `${unverified.length} other menu link(s) were not verified` : '',
    ].filter(Boolean);
    const cited = working[0] ?? unverified[0] ?? failed[0];
    evidence.push({
      sourceUrl: cited.url,
      evidenceType: 'MENU_AVAILABILITY',
      fact:
        working.length > 0
          ? `A working menu was verified at ${working[0].url}${others.length > 0 ? `; ${others.join('; ')}` : ''}.`
          : unverified.length > 0
            ? `Menu availability was not verified: ${unverified.length} menu link(s) could not be verified` +
              `${failed.length > 0 ? `, and ${failed.length} failed when tested or have no menu yet` : ''}.`
            : 'No readable menu was found: every linked menu destination failed when tested or has no menu published yet.',
      supportingContext:
        all.map((d) => `${d.url} — ${LABEL[d.status]} (${d.note}).`).join(' ') +
        ' Each menu link is judged on its own: a working link is not cancelled by a broken one, and a link that was not ' +
        'verified is neither counted as working nor as broken.',
      confidence: working.length > 0 ? 90 : unverified.length > 0 ? 55 : 85,
    });
  }

  // Collection failures
  for (const f of failures) {
    evidence.push({
      sourceUrl: f.url,
      evidenceType: 'COLLECTION_FAILURE',
      fact: `Page could not be collected (${f.status}): ${f.url}`,
      supportingContext: f.note,
      confidence: 90,
    });
  }

  return evidence;
}

/**
 * "An online ordering pathway", not "A online ordering pathway". Client-facing
 * copy, so the article has to agree with the label it precedes; FAQ is spelled
 * out because it reads as "eff-ay-que".
 */
function indefiniteArticle(noun: string): 'A' | 'An' {
  return /^(?:[aeiou]|faq\b)/i.test(noun) ? 'An' : 'A';
}

/**
 * Addresses that are published on a page but are not a way to reach the
 * restaurant: automated senders, and addresses belonging to the site's tooling
 * rather than the business. Reporting one as the contact route would replace an
 * old false negative with a new false positive.
 */
// The local-part alternatives MUST terminate at the "@". Anchoring them at the
// start alone makes every entry a prefix match, which excluded
// `abusedchef@…`, `noreplyparties@…` and `postmasterchef@…` — real addresses
// discarded by the very guard that exists to prevent false claims.
const NON_CONTACT_ADDRESS =
  /^(?:no-?reply|donotreply|do-not-reply|postmaster|mailer-daemon|abuse|wix|sentry)@|@(?:sentry\.io|wixpress\.com|squarespace\.com|sentry-next\.wixpress\.com|example\.(?:com|org|net)|domain\.com|email\.com)$/i;

/** "a and b" for two, "a, b and c" for three — client-facing prose, not a join. */
function joinRoutes(routes: string[]): string {
  if (routes.length <= 1) return routes[0] ?? '';
  return `${routes.slice(0, -1).join(', ')} and ${routes[routes.length - 1]}`;
}

/**
 * 401, 403 or 429. probeLink reports these as ok — the destination exists and
 * answered — but the server refused to show the page, so nothing about its
 * content was observed. Reachable, never verified.
 */
function isAccessRestricted(probe: ProbeResult): boolean {
  return probe.ok && (probe.httpStatus === 401 || probe.httpStatus === 403 || probe.httpStatus === 429);
}

/** What one menu destination showed when tested or fetched. */
type MenuDestinationStatus = 'working' | 'failed' | 'placeholder' | 'unverified';

/**
 * One key per destination — the collector's own normalisation, so a key here
 * matches the link it came from. The fragment is dropped and the host
 * lower-cased; a trailing slash is dropped ONLY on the root path.
 *
 * Stripping every trailing slash merged /menu and /menu/ — two resources a
 * server may answer differently — so whichever probe ran last overwrote the
 * other, and a 200 at /menu beside a 404 at /menu/ came out as "every menu
 * destination failed" or as a verified menu depending on probe order. Two
 * addresses are the same destination only when a redirect shows it (see
 * MENU AVAILABILITY).
 */
function destinationKey(url: string): string {
  try {
    return normalizeUrl(new URL(url));
  } catch {
    return url.replace(/#.*$/, '');
  }
}

/** Why a form's purpose was not established, in words the client can check. */
function unverifiedReasonText(form: UnverifiedForm): string {
  const named = joinRoutes(form.topics.map((t) => `${t}s`));
  switch (form.reason) {
    case 'CONFLICTING_EVIDENCE':
      return `The form both invites contact and names a specific purpose (${named}), so whether it takes other enquiries is unclear.`;
    case 'SEVERAL_PURPOSES':
      return `The form names several specific purposes (${named}) and does not invite general enquiries.`;
    case 'NO_USABLE_SUBMIT_CONTROL':
      return 'No visible, enabled submit button was found on the form, so whether a visitor can send it could not be observed.';
    case 'NO_PURPOSE_EVIDENCE':
    default:
      return "Nothing in the form's own heading, attributes or submit button says what it is for, and a message box alone does not show that it takes general enquiries.";
  }
}

/** Pathway categories that assert a customer can transact, and so must be clean. */
function isTransactional(key: string): boolean {
  return key === 'reservation' || key === 'ordering';
}

/**
 * True when a categorized link is somewhere a customer could actually be sent.
 *
 * `classifyDestination` already refuses API endpoints and static assets, but it
 * was only consulted on the probe path. A URL lifted out of a `data-*`
 * attribute skipped it entirely, so `admin-ajax.php?action=order_status` —
 * WordPress's internal AJAX endpoint — reached the report as "an online
 * ordering pathway is publicly reachable through an embedded widget". Applying
 * the same classifier here closes that route in.
 */
function isCustomerReachable(link: CategorizedLink): boolean {
  const kind = classifyDestination(link.href).kind;
  return kind !== 'API_ENDPOINT' && kind !== 'STATIC_ASSET';
}

/** True for an address that is not a customer contact route. */
export function isNonContactAddress(address: string): boolean {
  return NON_CONTACT_ADDRESS.test(address.trim());
}

/** Appended wherever an absence is reported on an incomplete collection. */
export const INCOMPLETE_COLLECTION_CAVEAT =
  'At least one page could not be collected, so this absence is not conclusive — the detail may appear on a page the audit could not read.';

/**
 * Phrase an absence as a finding, never as a certainty the data cannot support.
 *
 * With every intended page read, "was not detected on the analyzed pages" is an
 * honest statement of what was looked at. With a page missing, the same
 * sentence overstates: the only defensible claim is that it was not found in
 * what could be read.
 */
export function absenceClaim(subject: string, collectionIncomplete: boolean): string {
  return collectionIncomplete
    ? `${subject} was found on the pages that could be collected, but collection was incomplete.`
    : `${subject} was detected on the analyzed website pages.`;
}

function isExternal(href: string, homeUrl: string): boolean {
  try {
    return new URL(href).hostname !== new URL(homeUrl).hostname;
  } catch {
    return false;
  }
}

function hostOf(href: string): string {
  try {
    return new URL(href).hostname;
  } catch {
    return href;
  }
}

// Named reservation/ordering platforms, matched against the destination host.
const PLATFORM_PATTERNS: [RegExp, string][] = [
  [/spothopperapp\.|spothopper|spotapps/i, 'SpotHopper'],
  [/opentable\./i, 'OpenTable'],
  [/resy\./i, 'Resy'],
  [/sevenrooms\./i, 'SevenRooms'],
  [/tockhq\.|exploretock\./i, 'Tock'],
  [/yelp\.[a-z]+\/reservations|yelp\.to/i, 'Yelp Reservations'],
  [/toasttab\.|order\.toast/i, 'Toast'],
  [/doordash\./i, 'DoorDash'],
  [/ubereats\.|uber\.com\/.*eats/i, 'Uber Eats'],
  [/grubhub\./i, 'Grubhub'],
  [/postmates\./i, 'Postmates'],
  [/chownow\./i, 'ChowNow'],
  [/slicelife\.|slice\./i, 'Slice'],
  [/olo\.com|olobservice/i, 'Olo'],
  [/square(up)?\./i, 'Square'],
  [/clover\./i, 'Clover'],
  [/menufy\./i, 'Menufy'],
];

/** Identify a known reservation/ordering platform from candidate URLs, or null. */
export function detectPlatform(urls: string[]): string | null {
  for (const url of urls) {
    const host = hostOf(url);
    for (const [pattern, name] of PLATFORM_PATTERNS) {
      if (pattern.test(host) || pattern.test(url)) return name;
    }
  }
  return null;
}
