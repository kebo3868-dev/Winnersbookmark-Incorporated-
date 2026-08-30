import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import {
  normalizeNameText,
  parseTitleForName,
  resolveRestaurantName,
  shouldReplaceStoredName,
} from '@/lib/audit/restaurantName';

/**
 * MEDIUM 7 — RESTAURANT NAME NORMALIZATION
 *
 * The restaurant is Leverock's Great Seafood. Its homepage says so. The audit —
 * and the PDF the owner is handed — said "Leverocks Great Seafood", because
 * nothing ever read the site's own statement of its name; the name came from
 * whatever an operator typed, and an operator typing quickly does not reach for
 * an apostrophe.
 */

const page = (html: string, url = 'https://leverocks.example/') => extractPage(url, url, 200, 'text/html', html);

describe('the Leverock&rsquo;s case', () => {
  const LEVEROCKS = `
    <title>Leverock's Great Seafood | Waterfront Dining in St. Pete</title>
    <meta property="og:site_name" content="Leverock's Great Seafood" />
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Restaurant","name":"Leverock's Great Seafood","servesCuisine":"Seafood"}
    </script>
    <h1>Leverock's</h1>
  `;

  it('reads the name out of the page', () => {
    const extracted = page(LEVEROCKS);
    expect(extracted.structuredNames).toContain("Leverock's Great Seafood");
    expect(extracted.ogSiteName).toBe("Leverock's Great Seafood");
  });

  it("resolves to Leverock's Great Seafood, apostrophe intact", () => {
    const extracted = page(LEVEROCKS);
    const resolved = resolveRestaurantName({
      structuredNames: extracted.structuredNames,
      ogSiteName: extracted.ogSiteName,
      ogTitle: extracted.ogTitle,
      pageTitle: extracted.title,
      h1: extracted.h1,
      userProvided: 'Leverocks Great Seafood',
      hostname: 'leverocks.example',
    });
    expect(resolved.name).toBe("Leverock's Great Seafood");
    expect(resolved.source).toBe('STRUCTURED_DATA');
  });

  it('replaces the operator-typed spelling', () => {
    const resolved = resolveRestaurantName({ structuredNames: ["Leverock's Great Seafood"] });
    expect(shouldReplaceStoredName('Leverocks Great Seafood', resolved)).toBe(true);
  });
});

describe('precedence', () => {
  const all = {
    structuredNames: ['Structured Name'],
    ogSiteName: 'OG Site Name',
    ogTitle: 'OG Title',
    pageTitle: 'Page Title',
    h1: 'Heading Name',
    userProvided: 'Typed Name',
    hostname: 'example.com',
  };

  it('walks the list in order, taking the first usable source', () => {
    expect(resolveRestaurantName(all).source).toBe('STRUCTURED_DATA');
    expect(resolveRestaurantName({ ...all, structuredNames: [] }).source).toBe('OG_SITE_NAME');
    expect(resolveRestaurantName({ ...all, structuredNames: [], ogSiteName: null }).source).toBe('OG_TITLE');
    expect(resolveRestaurantName({ ...all, structuredNames: [], ogSiteName: null, ogTitle: null }).source).toBe('PAGE_TITLE');
    expect(resolveRestaurantName({ ...all, structuredNames: [], ogSiteName: null, ogTitle: null, pageTitle: null }).source).toBe('HEADING');
    expect(
      resolveRestaurantName({ ...all, structuredNames: [], ogSiteName: null, ogTitle: null, pageTitle: null, h1: null }).source,
    ).toBe('USER_PROVIDED');
    expect(resolveRestaurantName({ hostname: 'www.example.com' })).toEqual({
      name: 'example.com',
      source: 'HOSTNAME',
      reason: expect.any(String),
    });
  });

  it('skips a metadata source that is not a name', () => {
    // A page titled "Home" tells the audit nothing, and using it would replace a
    // correct typed name with a wrong one.
    const resolved = resolveRestaurantName({ pageTitle: 'Home', h1: 'Welcome', userProvided: 'Real Restaurant Name' });
    expect(resolved.name).toBe('Real Restaurant Name');
    expect(resolved.source).toBe('USER_PROVIDED');
  });

  it('reads a name out of a JSON-LD @graph and nested types', () => {
    const extracted = page(`
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[
          {"@type":"WebPage","name":"Home"},
          {"@type":["LocalBusiness","Restaurant"],"name":"Café Münchner"}
        ]}
      </script>
    `);
    // The WebPage name is the PAGE's name, not the business's, and must not win.
    expect(extracted.structuredNames).toEqual(['Café Münchner']);
  });

  it('survives malformed JSON-LD without throwing', () => {
    expect(() => page('<script type="application/ld+json">{not json</script>')).not.toThrow();
    expect(page('<script type="application/ld+json">{not json</script>').structuredNames).toEqual([]);
  });
});

describe('punctuation and branding are preserved', () => {
  it('keeps apostrophes, accents, ampersands and hyphens', () => {
    for (const name of ["Leverock's Great Seafood", 'Café Münchner', 'Smith & Sons', 'Chick-fil-A', "O'Malley's Pub"]) {
      expect(resolveRestaurantName({ structuredNames: [name] }).name, name).toBe(name);
    }
  });

  it('folds a curly apostrophe to a straight one so the two are one name', () => {
    expect(normalizeNameText('Leverock’s Great Seafood')).toBe("Leverock's Great Seafood");
  });

  it('collapses whitespace without touching anything else', () => {
    expect(normalizeNameText('  Leverock\'s   Great\n Seafood ')).toBe("Leverock's Great Seafood");
  });
});

describe('title suffixes are parsed conservatively, never blindly stripped', () => {
  it('separates a tagline that follows a real separator', () => {
    expect(parseTitleForName("Leverock's Great Seafood | Waterfront Dining in St. Pete")).toBe("Leverock's Great Seafood");
    expect(parseTitleForName('Blue Crab Grill – Official Site')).toBe('Blue Crab Grill');
  });

  it('does NOT split on a hyphen inside a brand name', () => {
    // A bare hyphen with no surrounding spaces is part of the name far more
    // often than it is a separator.
    expect(parseTitleForName('Chick-fil-A')).toBe('Chick-fil-A');
    expect(parseTitleForName('T-Bone Steakhouse')).toBe('T-Bone Steakhouse');
  });

  it('keeps the whole title when no segment reads as a tagline', () => {
    expect(parseTitleForName('Harbour Grill | Fisherman\'s Wharf')).toBe('Harbour Grill');
    expect(parseTitleForName('Leverock&rsquo;s Great Seafood')).toBe('Leverock&rsquo;s Great Seafood');
  });

  it('rejects a title that is not a name at all', () => {
    expect(parseTitleForName('Home')).toBeNull();
    expect(parseTitleForName('404')).toBeNull();
    expect(parseTitleForName('')).toBeNull();
  });
});

describe('an operator-typed name is not overwritten by another guess', () => {
  it('refuses to replace from USER_PROVIDED or HOSTNAME sources', () => {
    expect(shouldReplaceStoredName('Typed Name', { name: 'Typed Name', source: 'USER_PROVIDED', reason: '' })).toBe(false);
    expect(shouldReplaceStoredName('Typed Name', { name: 'example.com', source: 'HOSTNAME', reason: '' })).toBe(false);
  });

  it('does not write a resolved name identical to the stored one', () => {
    expect(shouldReplaceStoredName("Leverock's Great Seafood", {
      name: "Leverock's Great Seafood",
      source: 'STRUCTURED_DATA',
      reason: '',
    })).toBe(false);
  });

  it('treats a curly-apostrophe stored name as already matching', () => {
    expect(shouldReplaceStoredName('Leverock’s Great Seafood', {
      name: "Leverock's Great Seafood",
      source: 'STRUCTURED_DATA',
      reason: '',
    })).toBe(false);
  });
});
