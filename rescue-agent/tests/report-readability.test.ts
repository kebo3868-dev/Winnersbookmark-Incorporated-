/**
 * THE CLIENT REPORT IS READABLE ON A PHONE.
 *
 * A production-mode check on Pixel 7 and iPhone SE found about 140 of 300
 * text blocks on the client report below WCAG AA contrast: secondary text used
 * ivory-faint #7d766a (3.97:1 on cards) and gold text used gold-dim #8a6f33
 * (3.74:1). The contact phone link was 17 px tall, under the 24 px WCAG 2.2
 * minimum tap target. These tests pin the fixed colours and markup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../tailwind.config';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const colors = (config.theme?.extend as any).colors;
const backgrounds = [colors.obsidian.DEFAULT, colors.obsidian.soft, colors.obsidian.card];

describe('text colours meet WCAG AA (4.5:1) on every page background', () => {
  for (const [name, value] of [
    ['ivory.faint', colors.ivory.faint],
    ['ivory.dim', colors.ivory.dim],
    ['gold.muted', colors.gold.muted],
    ['gold.DEFAULT', colors.gold.DEFAULT],
  ] as const) {
    it(name, () => {
      for (const bg of backgrounds) expect(contrast(value, bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('gold.dim stays below AA, so it is never used for text on report pages', () => {
    expect(contrast(colors.gold.dim, colors.obsidian.card)).toBeLessThan(4.5);
    for (const file of [
      'src/app/audits/[auditId]/report/page.tsx',
      'src/app/audits/[auditId]/sales/page.tsx',
      'src/app/audits/[auditId]/page.tsx',
      'src/components/ScenarioCalculator.tsx',
    ]) {
      expect(read(file), file).not.toMatch(/text-gold-dim/);
    }
  });
});

describe('the contact phone link is a full-size tap target', () => {
  it('is at least 24 px tall (WCAG 2.2 AA target size)', () => {
    const page = read('src/app/audits/[auditId]/report/page.tsx');
    expect(page).toMatch(/<a href=\{dto\.cta\.phoneHref\} className="inline-block min-h-\[24px\] py-1 /);
  });
});
