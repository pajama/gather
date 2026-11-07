#!/usr/bin/env node
/**
 * Captures screenshots of the static web build for visual review.
 *
 *   npm run build:web && node scripts/screenshots.mjs [dist] [out]
 *
 * Uses playwright-core with a Chromium you already have
 * (CHROMIUM_PATH, or the Playwright cache under ~/.cache/ms-playwright).
 * Console errors from the app are printed so a broken screen fails loudly.
 */
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { extname, join, normalize } from 'node:path';

import { chromium } from 'playwright-core';

const DIST = process.argv[2] ?? 'dist';
const OUT = process.argv[3] ?? 'screenshots';
const ONLY = process.env.ONLY?.split(',');

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  for (const dir of readdirSync(cache).sort().reverse()) {
    for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const candidate = join(cache, dir, rel);
      if (dir.startsWith('chromium-') && existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(DIST, path);
  try {
    const body = await readFile(existsSync(file) && extname(file) ? file : join(DIST, 'index.html'));
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'text/html' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const errors = [];

async function session({ width, height, scheme = 'light', scale = 2 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: scheme });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${scheme} ${width}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[${scheme} ${width}] pageerror: ${err.message}`));
  return { context, page };
}

const shots = [];
async function shot(page, name) {
  if (ONLY && !ONLY.some((o) => name.includes(o))) return;
  await page.waitForTimeout(450);
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  shots.push(path);
}

async function scrollMain(page, y) {
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, y);
  await page.waitForTimeout(400);
}

// Phone, light
{
  const { context, page } = await session({ width: 390, height: 844 });
  await page.goto(base + '/');
  await page.getByText('Lemon Herb Roast Chicken').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await shot(page, '01-library');
  await page.getByText('Lemon Herb Roast Chicken').first().click();
  await page.getByText('Ingredients').first().waitFor();
  await page.waitForTimeout(800);
  await shot(page, '02-recipe-top');
  await scrollMain(page, 560);
  await shot(page, '03-recipe-ingredients');
  await scrollMain(page, 700);
  await shot(page, '04-recipe-method');
  await page.getByText('Start cooking').first().click().catch(() => {});
  await page.goto(page.url().replace(/\/?$/, '') + '/cook').catch(() => {});
  await page.getByText(/Step 1 of/).first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.getByRole('button', { name: 'Next' }).first().click().catch(() => {});
  await page.getByRole('button', { name: 'Next' }).first().click().catch(() => {});
  await page.getByRole('button', { name: 'Next' }).first().click().catch(() => {});
  await page.getByRole('button', { name: 'Next' }).first().click().catch(() => {});
  await page.waitForTimeout(900);
  await shot(page, '05-cook-mode');
  await page.getByText(/Start 1 hr 15 min timer/).first().click().catch(() => {});
  await shot(page, '06-cook-timer');
  await page.goto(base + '/');
  await page.getByText('Fluffy Buttermilk Pancakes').first().click();
  await page.getByRole('button', { name: 'Add to groceries' }).first().click();
  await page.getByText(/Add \d+ items/).first().click();
  await page.goto(base + '/');
  await page.getByText('Thai Green Curry with Vegetables').first().click();
  await page.getByRole('button', { name: 'Add to groceries' }).first().click();
  await page.getByText(/Add \d+ items/).first().click();
  await page.goto(base + '/groceries');
  await page.getByText('Groceries').first().waitFor();
  await shot(page, '07-groceries');
  await page.goto(base + '/plan');
  await page.getByText('Plan').first().waitFor();
  await shot(page, '08-plan');
  await page.goto(base + '/settings');
  await page.getByText('Accent color').first().waitFor({ timeout: 15000 });
  await shot(page, '09-settings');
  await page.goto(base + '/import?mode=text');
  await page.getByText('Import Recipe').first().waitFor({ timeout: 15000 });
  await shot(page, '10-import');
  await context.close();
}

// Live import and feeds (needs a build made with EXPO_PUBLIC_IMPORT_PROXY and that proxy running).
if (process.env.IMPORT_URL || process.env.FEED_URL) {
  const { context, page } = await session({ width: 390, height: 844 });
  await page.goto(base + '/');
  await page.getByText('Recipes').first().waitFor({ timeout: 20000 });
  if (process.env.IMPORT_URL) {
    await page.goto(`${base}/import?url=${encodeURIComponent(process.env.IMPORT_URL)}`);
    await page.getByText('Save recipe').first().waitFor({ timeout: 30000 });
    await shot(page, '15-import-preview');
    await page.getByText('Save recipe').first().click();
    await page.getByText('Ingredients').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await shot(page, '16-imported-recipe');
  }
  if (process.env.FEED_URL) {
    await page.goto(base + '/discover');
    await page.getByText('Follow your favorite food blogs').first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Manage feeds' }).first().click();
    await page.getByPlaceholder('Blog or feed address').fill(process.env.FEED_URL);
    await page.getByRole('button', { name: 'Follow' }).first().click();
    await page.getByText('Following').first().waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Close' }).last().click();
    await page.waitForTimeout(1500);
    await shot(page, '17-discover');
  }
  await context.close();
}

// Phone, dark
{
  const { context, page } = await session({ width: 390, height: 844, scheme: 'dark' });
  await page.goto(base + '/');
  await page.getByText('Smoky Shakshuka').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await shot(page, '11-library-dark');
  await page.getByText('Smoky Shakshuka').first().click();
  await page.waitForTimeout(800);
  await shot(page, '12-recipe-dark');
  await context.close();
}

// Desktop / tablet
{
  const { context, page } = await session({ width: 1280, height: 860, scale: 1 });
  await page.goto(base + '/');
  await page.getByText('Miso Glazed Salmon').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await shot(page, '13-library-desktop');
  await page.getByText('Miso Glazed Salmon').first().click();
  await page.waitForTimeout(900);
  await scrollMain(page, 380);
  await shot(page, '14-recipe-desktop');
  await context.close();
}

await browser.close();
server.close();
console.log(shots.join('\n'));
if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of [...new Set(errors)].slice(0, 30)) console.log(' -', e);
  process.exitCode = 1;
}
