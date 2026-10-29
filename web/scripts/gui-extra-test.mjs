import { chromium } from 'playwright-core';
const exe = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const out = process.env.OUT_DIR || './gui-test-screenshots';
const base = process.env.APUI_URL || 'http://127.0.0.1:7778/';
const errors = [];
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);

// Settings tabs
await page.getByRole('link', { name: /设置/ }).first().click();
await page.waitForTimeout(600);
for (const tab of ['输出', 'DSD', '电台', '高级', '状态', '常规']) {
  await page.getByRole('button', { name: tab, exact: true }).click();
  await page.waitForTimeout(250);
  console.log('TAB', tab, 'PAGES', await page.locator('.page.settings-page').count(), 'TITLE', await page.locator('.settings-section h3').first().innerText().catch(() => '-'));
}
await page.screenshot({ path: `${out}/p12-settings-tabs.png`, fullPage: true });

// Playlist load subalbum
await page.getByRole('link', { name: /播放列表/ }).first().click();
await page.waitForTimeout(900);
const row = page.locator('.browser-row').filter({ hasText: 'Aurora Sessions' }).first();
await row.getByRole('button', { name: '载入' }).click();
await page.waitForTimeout(1800);
console.log('AFTER_LOAD_URL', page.url());
console.log('AFTER_LOAD_CARDS', await page.locator('.album-card').count());
console.log('AFTER_LOAD_HAS_AURORA', (await page.locator('body').innerText()).includes('Aurora Sessions'));
await page.screenshot({ path: `${out}/p13-playlist-loaded.png`, fullPage: true });

// Restore root music
await page.getByRole('link', { name: /播放列表/ }).first().click();
await page.waitForTimeout(900);
const musicRow = page.locator('.browser-row').filter({ hasText: '/opt/aplayer/music' }).first();
await musicRow.getByRole('button', { name: '载入' }).click();
await page.waitForTimeout(1800);
console.log('RESTORE_CARDS', await page.locator('.album-card').count());

// File browser
await page.getByRole('link', { name: /文件浏览/ }).first().click();
await page.waitForTimeout(800);
console.log('BROWSER_ROWS', await page.locator('.browser-row').count());
await page.screenshot({ path: `${out}/p14-browser.png`, fullPage: true });
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
