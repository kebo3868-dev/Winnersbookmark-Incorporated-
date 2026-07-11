import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { discoverRelevantPages, MAX_PAGES } from '@/lib/web/discovery';

const HTML = `
<html><head>
<title>Blue Harbor Grill — Seafood & Steaks</title>
<meta name="description" content="Fresh seafood in Portside.">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head><body>
<nav>
  <a href="/menu">Menu</a>
  <a href="/contact">Contact</a>
  <a href="/menu">Menu duplicate</a>
  <a href="https://www.opentable.com/blue-harbor">Reserve a Table</a>
  <a href="https://order.toasttab.com/blue-harbor">Order Online</a>
  <a href="/catering">Catering</a>
  <a href="/private-dining">Private Dining</a>
  <a href="/gift-cards">Gift Cards</a>
  <a href="/faq">FAQ</a>
  <a href="/about">About</a>
  <a href="/hours">Hours</a>
  <a href="/events">Events</a>
  <a href="/careers">Careers</a>
  <a href="https://www.instagram.com/blueharbor">Instagram</a>
</nav>
<a href="tel:+15550137788">Call (555) 013-7788</a>
<p>Visit us at 12 Harbor Street, Portside. Open Mon-Fri 11:00am - 10:00pm</p>
<p>Join our email list! <form><input type="email"></form></p>
<a href="/menu.pdf">Download Menu PDF</a>
</body></html>`;

describe('extractPage', () => {
  const page = extractPage('https://blueharbor.example', 'https://blueharbor.example/', 200, 'text/html', HTML);

  it('extracts identity, phone, click-to-call, hours, address', () => {
    expect(page.title).toContain('Blue Harbor Grill');
    expect(page.metaDescription).toContain('Fresh seafood');
    expect(page.hasViewportMeta).toBe(true);
    expect(page.phones[0]).toMatch(/555.*013.*7788/);
    expect(page.clickToCallLinks).toBeGreaterThan(0);
    expect(page.hoursText).toMatch(/11:00am/i);
    expect(page.addressText).toMatch(/12 Harbor Street/i);
    expect(page.emailCaptureSignal).toBe(true);
  });

  it('categorizes reservation/ordering/menu/social links', () => {
    expect(page.categorizedLinks.reservation?.some((l) => l.href.includes('opentable'))).toBe(true);
    expect(page.categorizedLinks.ordering?.some((l) => l.href.includes('toasttab'))).toBe(true);
    expect(page.categorizedLinks.menu?.length).toBeGreaterThan(0);
    expect(page.socialLinks.some((l) => l.includes('instagram'))).toBe(true);
    expect(page.pdfLinks.some((l) => l.endsWith('.pdf'))).toBe(true);
  });
});

describe('discoverRelevantPages', () => {
  const page = extractPage('https://blueharbor.example', 'https://blueharbor.example/', 200, 'text/html', HTML);

  it('respects the page limit', () => {
    const targets = discoverRelevantPages(page);
    expect(targets.length).toBeLessThanOrEqual(MAX_PAGES - 1);
  });

  it('deduplicates repeated URLs', () => {
    const targets = discoverRelevantPages(page);
    const urls = targets.map((t) => t.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('only selects same-host pages (external platforms are probed, not crawled)', () => {
    const targets = discoverRelevantPages(page);
    for (const t of targets) {
      expect(new URL(t.url).hostname).toBe('blueharbor.example');
    }
  });

  it('prioritizes menu and contact over about/careers', () => {
    const targets = discoverRelevantPages(page, 3);
    const types = targets.map((t) => t.sourceType);
    expect(types).toContain('MENU');
    expect(types).toContain('CONTACT');
    expect(types).not.toContain('CAREERS');
  });
});
