import { detectWidgetVendor, type PageExtract } from '@/lib/web/collector';
import type { EvidenceInput } from '@/types/audit';

export interface ProbeResult {
  url: string;
  category: 'reservation' | 'ordering' | 'menu';
  ok: boolean;
  httpStatus?: number;
  note: string;
  /** Destination reached after redirects, when it differs from the link href. */
  finalUrl?: string;
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
  for (const check of pathChecks) {
    const found = new Map<string, string>();
    for (const page of pages) {
      for (const link of page.categorizedLinks[check.key] ?? []) {
        if (!found.has(link.href)) found.set(link.href, link.text);
      }
    }
    if (found.size > 0) {
      const [firstHref, firstText] = Array.from(found.entries())[0];
      const external = isExternal(firstHref, home.finalUrl);
      const platform = (check.key === 'reservation' || check.key === 'ordering')
        ? detectPlatform(Array.from(found.keys()))
        : null;
      evidence.push({
        sourceUrl: firstHref,
        evidenceType: check.type,
        fact: `A ${check.label} pathway is publicly linked${platform ? ` via ${platform}` : external ? ' to an external platform' : ''} (${found.size} link(s) found).`,
        supportingContext: `Example link text: "${firstText || '(no text)'}" → ${firstHref}`,
        confidence: 90,
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

  // Probes (broken links)
  for (const probe of probes) {
    if (!probe.ok) {
      evidence.push({
        sourceUrl: probe.url,
        evidenceType: 'BROKEN_LINK',
        fact: `The linked ${probe.category} destination failed when tested (${probe.note}).`,
        supportingContext: probe.url,
        confidence: probe.httpStatus ? 95 : 75,
      });
    } else {
      // Name the destination actually reached, and the vendor operating it —
      // "where does this button lead" is the question the audit is answering.
      const resolved = probe.finalUrl && probe.finalUrl !== probe.url ? probe.finalUrl : null;
      const operator = detectPlatform([probe.finalUrl ?? probe.url]);
      evidence.push({
        sourceUrl: probe.url,
        evidenceType: probe.category === 'reservation' ? 'RESERVATION_PATH' : probe.category === 'ordering' ? 'ORDERING_PATH' : 'MENU_ACCESS',
        fact:
          `The linked ${probe.category} destination responded successfully when tested (${probe.note})` +
          `${operator ? ` and is operated by ${operator}` : ''}.`,
        supportingContext: resolved ? `${probe.url} → resolves to ${resolved}` : probe.url,
        confidence: 90,
      });
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
