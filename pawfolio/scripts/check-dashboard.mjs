import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 900 },
    timezoneId: 'Asia/Manila',
  });
  await page.goto(
    (process.env.BASE_URL || 'http://127.0.0.1:5179') +
      '/dashboard?designPreview=1',
  );
  await page.locator('.care-update-label').waitFor();
  const checks = [];
  checks.push([
    'care update label is uppercase',
    (await page
      .locator('.care-update-label')
      .evaluate((n) => getComputedStyle(n).textTransform)) === 'uppercase',
  ]);
  const bell = await page.locator('.notification-trigger').boundingBox();
  const add = await page.locator('.topline-add-dog').boundingBox();
  checks.push([
    'mobile header actions share a row with a compact gap',
    Math.abs(bell.y - add.y) < 2 &&
      add.x - (bell.x + bell.width) >= 8 &&
      add.x - (bell.x + bell.width) <= 16,
  ]);
  checks.push([
    'grooming appointment appears once on the dashboard',
    (await page.getByText('Bath and nail trim', { exact: true }).count()) === 1,
  ]);
  checks.push([
    'no horizontal overflow',
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  checks.push([
    'desktop has no horizontal overflow',
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ]);
  for (const [name, passed] of checks)
    console.log(passed ? 'PASS' : 'FAIL', name);
  assert(
    checks.every(([, passed]) => passed),
    'Dashboard regression checks failed.',
  );
} finally {
  await browser.close();
}
