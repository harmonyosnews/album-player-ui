import { chromium } from 'playwright-core';
const exe = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const out = process.env.OUT_DIR || './gui-test-screenshots';
const base = process.env.APUI_URL || 'http://127.0.0.1:7778/';
const errors = [];
const bad = [];
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await page.getByRole('link', { name: /文件浏览/ }).first().click();
await page.waitForTimeout(900);

async function rowAt(path) {
  return page.locator('.browser-row').filter({ has: page.locator('.browser-path', { hasText: new RegExp('^' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).first();
}
async function expand(path) {
  const row = await rowAt(path);
  console.log('ROW', path, await row.count());
  const btns = await row.getByRole('button').allTextContents();
  console.log('BTNS', path, btns);
  const toggle = row.getByRole('button').first();
  await toggle.click();
  await page.waitForTimeout(900);
}
await expand('/mnt');
await expand('/mnt/samba');
await expand('/mnt/samba/Test');
await page.screenshot({ path: `${out}/r01-browse-test.png`, fullPage: true });
const fmt = await rowAt('/music/Test/FLAC-16-44.1');
console.log('FMT_ROW', await fmt.count());
await fmt.getByRole('button', { name: '载入' }).click();
await page.waitForTimeout(1800);
console.log('URL', page.url());
console.log('ALBUM_CARDS', await page.locator('.album-card').count());
await page.screenshot({ path: `${out}/r02-real-albums.png`, fullPage: true });
const firstAlbum = page.locator('.album-card').first();
if (await firstAlbum.count()) {
  await firstAlbum.click();
  await page.waitForTimeout(900);
  const firstTrack = page.locator('.track-row').first();
  if (await firstTrack.count()) {
    await firstTrack.click();
    await page.waitForTimeout(1600);
    console.log('PLAYER_TITLE', await page.locator('.player-title').innerText());
    console.log('PLAYER_FORMAT', await page.locator('.player-format').innerText());
    await page.screenshot({ path: `${out}/r03-real-playing.png`, fullPage: true });
    const stop = page.getByRole('button', { name: '停止' }).first();
    if (await stop.count()) await stop.click();
    await page.waitForTimeout(600);
  }
}
await page.getByRole('link', { name: /设置/ }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/r04-real-settings.png`, fullPage: true });
console.log('ERRORS', JSON.stringify(errors));
console.log('BAD', JSON.stringify(bad.slice(0, 10)));
await browser.close();
