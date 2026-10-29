import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const manualDir = resolve(root, 'docs/manual');
const template = readFileSync(resolve(manualDir, 'manual.template.html'), 'utf8');
const tocPath = process.argv[2] || '';
const outPath = process.argv[3] || resolve(manualDir, 'build/manual-draft.pdf');
const toc = tocPath && existsSync(tocPath) ? JSON.parse(readFileSync(tocPath, 'utf8')) : {};

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const license = readFileSync(resolve(root, 'LICENSE'), 'utf8')
  .replace(/\r/g, '')
  .split('\n')
  .map((line) => line.trimStart())
  .join('\n')
  .trim();

let html = template
  .replace('{{LICENSE}}', escapeHtml(license))
  .replace('{{NOTICE}}', escapeHtml(readFileSync(resolve(root, 'NOTICE'), 'utf8')));

for (const [key, page] of Object.entries(toc)) {
  html = html.replace(
    new RegExp(`(data-toc="${key}"[^>]*>)[^<]*(</span>)`),
    `$1${page}$2`,
  );
}

const buildHtml = resolve(manualDir, 'manual.build.html');
writeFileSync(buildHtml, html);
console.log('HTML', buildHtml);

const exe = process.env.CHROMIUM_PATH || '/home/kele/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(pathToFileURL(buildHtml).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
console.log('PDF', outPath);
await browser.close();
