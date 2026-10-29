import { chromium } from 'playwright-core';
import fs from 'node:fs';

const exe = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const out = process.env.OUT_DIR || './gui-test-screenshots';
const base = process.env.APUI_URL || 'http://127.0.0.1:5173/';
const errors = [];
const badResponses = [];
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/01-home.png`, fullPage: true });
const homeText = await page.locator('body').innerText();
console.log('HOME_HAS_ALBUM', homeText.includes('Analog Dreams'));
console.log('HOME_TITLE', await page.title());

// Open album
const albumCard = page.getByRole('button', { name: /打开专辑 Analog Dreams/ });
console.log('ALBUM_CARD_COUNT', await albumCard.count());
if (await albumCard.count()) {
  await albumCard.first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/02-album.png`, fullPage: true });
  console.log('ALBUM_URL', page.url());
  console.log('ALBUM_TEXT', (await page.locator('body').innerText()).includes('Warm Static'));
}

// Play first track
const track = page.getByRole('button', { name: /播放 Warm Static/ });
console.log('TRACK_COUNT', await track.count());
if (await track.count()) {
  await track.first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/03-playing.png`, fullPage: true });
  console.log('PLAYER_TITLE', await page.locator('.player-title').innerText());
  console.log('PLAYER_ARTIST', await page.locator('.player-artist').innerText());
}

// Now playing
const mini = page.locator('.mini-cover');
if (await mini.count()) {
  await mini.first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/04-now-playing.png`, fullPage: true });
  console.log('NOW_VISIBLE', await page.locator('#now-playing').isVisible());
  const close = page.locator('.now-close');
  if (await close.count()) await close.first().click();
  await page.waitForTimeout(400);
}

// Pause via player bar
const playBtn = page.locator('.player-bar .play-btn');
if (await playBtn.count()) {
  await playBtn.first().click();
  await page.waitForTimeout(1200);
  console.log('PAUSED_TEXT', await page.locator('.player-bar .play-btn').getAttribute('aria-label'));
}

// Settings
await page.getByRole('link', { name: /设置/ }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/05-settings.png`, fullPage: true });
console.log('SETTINGS_HAS_ROOT', (await page.locator('body').innerText()).includes('音乐根目录'));

// Radio
await page.getByRole('link', { name: /网络电台/ }).first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/06-radio.png`, fullPage: true });
const radioText = await page.locator('body').innerText();
console.log('RADIO_HAS_CATEGORY', radioText.includes('分类') || radioText.includes('JAZZ'));
console.log('RADIO_TEXT_HEAD', radioText.slice(0, 260).replace(/\n/g, ' | '));

// Back home
await page.getByRole('link', { name: /首页/ }).first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/07-home-return.png`, fullPage: true });
console.log('HOME_RETURN_HAS_ALBUM', (await page.locator('body').innerText()).includes('Analog Dreams'));

// Mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/08-mobile-home.png`, fullPage: true });
console.log('MOBILE_NAV_VISIBLE', await page.locator('.mobile-nav').isVisible());

console.log('CONSOLE_ERRORS', JSON.stringify(errors));
console.log('BAD_RESPONSES', JSON.stringify(badResponses.slice(0, 20)));
await browser.close();
