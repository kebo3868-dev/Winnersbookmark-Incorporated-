// Run from rescue-agent with PLAYWRIGHT_BROWSERS_PATH and PLAYWRIGHT_MODULE set.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const phase = process.env.REPORT_PHASE ?? 'before';
const folder = path.resolve('../reports/dependency-remediation', phase);
const css = fs.readdirSync('.next/static/css').filter(f => f.endsWith('.css')).sort().map(f => fs.readFileSync(path.join('.next/static/css', f), 'utf8')).join('\n');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const result = [];
const images = `/tmp/wbi-browser-captures/${phase}`;
fs.mkdirSync(images, { recursive: true });
for (const fixture of ['current', 'historical']) for (const surface of ['report', 'sales']) for (const width of [360, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.route('**/*', route => route.abort());
  const html = fs.readFileSync(path.join(folder, `${fixture}-${surface}.html`), 'utf8');
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const name = `${fixture}-${surface}-${width}`;
  const png = await page.screenshot({ path: `${images}/${name}.png`, fullPage: true, animations: 'disabled' });
  result.push({ name, sha256: crypto.createHash('sha256').update(png).digest('hex'),
    dimensions: await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewport: innerWidth })) });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(folder, 'browser-pages.json'), JSON.stringify(result, null, 2) + '\n');
if (phase === 'after') {
  const before = JSON.parse(fs.readFileSync('../reports/dependency-remediation/before/browser-pages.json'));
  if (JSON.stringify(result) !== JSON.stringify(before)) throw new Error('Browser render changed; inspect captures in /tmp/wbi-browser-captures');
}
console.log(JSON.stringify(result, null, 2));
