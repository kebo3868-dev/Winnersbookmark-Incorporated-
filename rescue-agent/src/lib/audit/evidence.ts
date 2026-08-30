import { detectWidgetVendor, type CategorizedLink, type PageExtract } from '@/lib/web/collector';
import type { EvidenceInput } from '@/types/audit';
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
      fact: `A phone number is publicly displayed (${anyPhone.phones[0]}).`,
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

  // Hours & address
  const hoursPage = pages.find((p) => p.hoursText);
  evidence.push({
    sourceUrl: hoursPage?.finalUrl ?? home.finalUrl,
    evidenceType: 'HOURS_VISIBILITY',
    fact: hoursPage
      ? 'Business hours are published on the website.'
      : 'Business hours were not detected in the text of the analyzed pages.',
    supportingContext: hoursPage ? `Detected hours text: "${hoursPage.hoursText}"` : analyzedNote,
    confidence: hoursPage ? 90 : 60,
  });
  const addressPage = pages.find((p) => p.addressText);
  evidence.push({
    sourceUrl: addressPage?.finalUrl ?? home.finalUrl,
    evidenceType: 'ADDRESS_VISIBILITY',
    fact: addressPage
      ? 'A street address is published on the website.'
      : 'A street address was not detected in the text of the analyzed pages.',
    supportingContext: addressPage ? `Detected address text: "${addressPage.addressText}"` : analyzedNote,
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

  for (const check of pathChecks) {
    const found = new Map<string, CategorizedLink>();
    for (const page of pages) {
      for (const link of page.categorizedLinks[check.key] ?? []) {
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
    } else if (check.key === 'contact' && (anyPhone || clickToCall)) {
      // A PHONE NUMBER IS A CONTACT PATHWAY.
      //
      // The audit reported "No public contact pathway was detected" on a site
      // that publishes its number and offers click-to-call — while the very same
      // evidence chain, two entries above, recorded both. Saying a restaurant
      // cannot be contacted when it plainly can is the kind of error an owner
      // spots instantly, and it costs the whole report its credibility.
      //
      // The real finding is narrower and still worth making: everything routes
      // through the phone, and there is no way to ask a question in writing.
      evidence.push({
        sourceUrl: home.finalUrl,
        evidenceType: 'CONTACT_PATH',
        fact:
          'A contact pathway is publicly available by telephone, but no non-phone contact route ' +
          '(contact page, enquiry form, or published email) was detected.',
        supportingContext:
          `${anyPhone ? `Phone number published: ${anyPhone.phones[0]}. ` : ''}` +
          `${clickToCall ? 'Click-to-call (tel:) links are present. ' : ''}` +
          'Customers can reach the restaurant; every enquiry has to become a phone call, so questions that arrive ' +
          'outside service hours have nowhere to go. ' +
          analyzedNote,
        confidence: 85,
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
  const smsCapture = pages.some((p) => p.smsCaptureSignal);
  evidence.push({
    sourceUrl: home.finalUrl,
    evidenceType: 'EMAIL_CAPTURE',
    fact: emailCapture
      ? 'An email capture mechanism (signup form or newsletter invitation) is publicly visible.'
      : 'No public email capture mechanism was detected on the analyzed pages.',
    supportingContext: analyzedNote,
    confidence: emailCapture ? 85 : 65,
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
    supportingContext: homeCtas.length > 0 ? `Examples: ${homeCtas.slice(0, 6).join(' | ')}` : null,
    confidence: 80,
  });
  if (homeCtas.length > 8) {
    evidence.push({
      sourceUrl: home.finalUrl,
      evidenceType: 'CTA_SIGNAL',
      fact: `Homepage presents ${homeCtas.length} competing CTAs, which can dilute the primary next action.`,
      supportingContext: homeCtas.slice(0, 10).join(' | '),
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
      evidence.push({
        sourceUrl: probe.url,
        evidenceType: 'TECHNICAL_SIGNAL',
        fact:
          `A ${probe.category} endpoint referenced by the site was tested and is not a customer-facing destination ` +
          `(${probe.note}).`,
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
      } else if (probe.category === 'menu' && probe.placeholderSignal) {
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
