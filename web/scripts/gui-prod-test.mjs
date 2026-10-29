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
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png`, fullPage: true }); };

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
await shot('p01-home');
console.log('HOME_ALBUM', (await page.locator('body').innerText()).includes('Analog Dreams'));

// search
const search = page.locator('.search-input');
await search.fill('Blue');
await page.waitForTimeout(700);
await shot('p02-search');
console.log('SEARCH_BLUE', await page.getByRole('button', { name: /打开专辑 Blue Hour/ }).count());
console.log('SEARCH_ANALOG', await page.getByRole('button', { name: /打开专辑 Analog Dreams/ }).count());
await search.fill('');
await page.waitForTimeout(500);

// album + play
await page.getByRole('button', { name: /打开专辑 Analog Dreams/ }).first().click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /播放 Warm Static/ }).first().click();
await page.waitForTimeout(2200);
await shot('p03-playing');
console.log('PLAYER_TITLE', await page.locator('.player-title').innerText());
console.log('PLAYER_FORMAT', await page.locator('.player-format').innerText());

// settings save test
await page.getByRole('link', { name: /设置/ }).first().click();
await page.waitForTimeout(900);
await shot('p04-settings');
const pf = page.locator('.setting-row').filter({ hasText: 'ALSA Period' }).locator('input');
await pf.fill('256');
await page.locator('.page-actions .btn-primary').click();
await page.waitForTimeout(1200);
const cfg = await (await fetch(base + '?GetConfig')).json();
console.log('SAVE_PFRAMES', cfg.pframes, 'COVERS', cfg.covers, 'ROOT', cfg.root_folder);
console.log('TOAST', await page.locator('.toast').innerText().catch(() => 'none'));
await shot('p05-settings-saved');
await pf.fill('128');
await page.locator('.page-actions .btn-primary').click();
await page.waitForTimeout(1200);
const cfg2 = await (await fetch(base + '?GetConfig')).json();
console.log('RESTORE_PFRAMES', cfg2.pframes);

// theme
await page.getByTitle(/切换到浅色主题/).click();
await page.waitForTimeout(500);
console.log('THEME', await page.locator('body').getAttribute('data-theme'));
await shot('p06-light');
await page.getByTitle(/切换到深色主题/).click();
await page.waitForTimeout(300);

// radio category
await page.getByRole('link', { name: /网络电台/ }).first().click();
await page.waitForTimeout(2500);
await shot('p07-radio');
console.log('RADIO_CARDS', await page.locator('.album-card').count());
const firstCat = page.locator('.album-card').first();
if (await firstCat.count()) {
  await firstCat.click();
  await page.waitForTimeout(1200);
  await shot('p08-radio-category');
  const station = page.locator('.track-row').first();
  if (await station.count()) {
    await station.click();
    await page.waitForTimeout(1800);
    await shot('p09-radio-playing');
    console.log('RADIO_PLAYER_ARTIST', await page.locator('.player-artist').innerText());
    console.log('RADIO_TOAST', await page.locator('.toast').innerText().catch(() => 'none'));
  }
}

// playlists
await page.getByRole('link', { name: /播放列表/ }).first().click();
await page.waitForTimeout(1000);
await shot('p10-playlists');
console.log('PLAYLIST_ROWS', await page.locator('.browser-row').count());

// mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
await shot('p11-mobile');
console.log('MOBILE_NAV', await page.locator('.mobile-nav').isVisible());
console.log('CONSOLE_ERRORS', JSON.stringify(errors));
console.log('BAD_RESPONSES', JSON.stringify(bad.slice(0, 10)));
await browser.close();
