import { chromium } from 'playwright-core';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
const base = process.env.BASE_URL || 'http://127.0.0.1:5179';
process.env.CLIENT_ORIGIN = base;
const db = await MongoMemoryServer.create();
let server, browser;
try {
  await mongoose.connect(db.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  server = createApp({
    temporaryDatabase: true,
    authRateLimit: false,
    contactMailer: async () => {},
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const apiBase = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const response = await route.fetch({
      url: apiBase + new URL(route.request().url()).pathname,
    });
    await route.fulfill({ response });
  });
  await page.goto(base + '/dashboard');
  await page.waitForURL(base + '/login');
  await page
    .getByRole('button', { name: 'Create an account', exact: true })
    .click();
  for (const [name, value] of [
    ['First name', 'Submission'],
    ['Last name', 'Check'],
    ['Email address', 'submission@example.com'],
    ['Username', 'submission_check'],
    ['Password', 'Submission-test-123!'],
    ['Confirm password', 'Submission-test-123!'],
  ])
    await page.getByLabel(name, { exact: true }).fill(value);
  await page.getByRole('checkbox').check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await page.waitForURL(base + '/dashboard');
  await page
    .getByRole('button', { name: 'Add your first dog', exact: true })
    .click();
  await page.locator('dialog input[name=name]').fill('Scott');
  await page.locator('dialog input[name=breed]').fill('Poodle');
  await page.getByLabel('Date of birth', { exact: true }).fill('01012022');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add dog', exact: true })
    .click();
  await page.locator('.dashboard-welcome').waitFor();
  await page.goto(base + '/dashboard/vaccinations');
  await page
    .getByRole('button', { name: 'Record vaccination', exact: true })
    .click();
  await page.locator('dialog input[name=name]').fill('Rabies');
  await page.getByLabel('Date administered', { exact: true }).fill('01012024');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await page.getByText('Next due date not set', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Schedule appointment', exact: true })
    .click();
  await page.locator('dialog input[name=title]').fill('Rabies booster visit');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await page.locator('dialog').waitFor({ state: 'detached' });
  await page.goto(base + '/dashboard/schedules');
  await page
    .getByText('Rabies booster visit', { exact: true })
    .first()
    .waitFor();
  for (const path of [
    '/dashboard/dog-profile',
    '/dashboard/my-dogs',
    '/dashboard/medical-history',
    '/dashboard/emergency-vault',
    '/dashboard/contact',
  ]) {
    await page.goto(base + path);
    await page.locator('.dashboard-main').waitFor();
    assert.equal(new URL(page.url()).pathname, path);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.goto(base + '/dashboard');
  await page
    .getByRole('button', { name: 'Toggle dashboard navigation', exact: true })
    .click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.waitForURL(base + '/login');
  assert.deepEqual(errors, []);
  console.log(
    'Passed isolated registration, protected routes, dog creation, masked dates, vaccination history, appointment persistence, section routing, mobile layout, and logout. No Atlas data used.',
  );
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  await db.stop();
}
