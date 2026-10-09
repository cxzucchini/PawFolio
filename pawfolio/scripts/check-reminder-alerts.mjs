import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:5179';
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
try {
  const context = await browser.newContext({
    timezoneId: 'Asia/Manila',
    viewport: { width: 1440, height: 900 },
  });
  const dog = {
    _id: '111111111111111111111111',
    name: 'Scott',
    breed: 'Poodle',
    gender: 'Male',
    dateOfBirth: '2022-01-01',
  };
  const reminders = [
    {
      _id: '222222222222222222222222',
      title: 'Bath and nail trim',
      type: 'Grooming',
      remindBeforeMinutes: 0,
      scheduledAt: '2026-10-09T03:00:10Z',
      completed: false,
    },
  ];
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/auth/me')
      ? { user: { id: 'alert-user', firstName: 'Jay' } }
      : path === '/api/dogs'
        ? { dogs: [dog] }
        : { dog, vaccinations: [], reminders };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-09T03:00:00Z') });
  await page.goto(`${base}/dashboard/schedules`);
  await page.locator('.schedule-board').waitFor();
  assert.equal(
    await page.locator('.reminder-toast').count(),
    0,
    'future reminders must not alert early',
  );
  await page.getByRole('button', { name: 'Add reminder', exact: true }).click();
  await page.locator('dialog input[name=title]').fill('Draft reminder');
  await page.clock.runFor(16000);
  assert.equal(
    await page.locator('.reminder-toast').count(),
    0,
    'popup must wait for the form',
  );
  assert.equal(
    await page.locator('dialog input[name=title]').inputValue(),
    'Draft reminder',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('.reminder-toast').waitFor();
  assert.equal(
    await page.locator('.reminder-toast li strong').textContent(),
    'Bath and nail trim',
  );
  assert.equal(
    await page
      .locator('.reminder-toast')
      .evaluate((node) => node.contains(document.activeElement)),
    false,
    'do not steal focus',
  );
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.locator('.reminder-toast').waitFor({ state: 'detached' });
  await page.reload();
  await page.locator('.schedule-board').waitFor();
  await page.clock.runFor(16000);
  assert.equal(
    await page.locator('.reminder-toast').count(),
    0,
    'dismissed occurrence must not repeat after reload',
  );
  reminders[0].scheduledAt = '2026-10-08T10:00:00Z';
  reminders.push({
    _id: '333333333333333333333333',
    title: 'Vet appointment',
    type: 'Vet visit',
    scheduledAt: '2026-10-08T11:00:00Z',
    completed: false,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('.reminder-toast').waitFor();
  assert.equal(
    await page.locator('.reminder-toast').count(),
    1,
    'group alerts into one popup',
  );
  assert.equal(await page.locator('.reminder-toast li').count(), 2);
  const box = await page.locator('.reminder-toast').boundingBox();
  assert(box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 900);
  await page
    .getByRole('button', { name: 'View schedule', exact: true })
    .click();
  await page.locator('.reminder-toast').waitFor({ state: 'detached' });
  assert.equal(new URL(page.url()).pathname, '/dashboard/schedules');
  assert.equal(
    reminders[0].completed,
    false,
    'viewing does not complete reminders',
  );
  const second = await context.newPage();
  await second.clock.install({ time: new Date('2026-10-09T03:00:00Z') });
  await second.goto(`${base}/dashboard/schedules`);
  await second.locator('.schedule-board').waitFor();
  await second.clock.runFor(16000);
  assert.equal(
    await second.locator('.reminder-toast').count(),
    0,
    'another tab must respect shown alerts',
  );
  await second.close();
  reminders.splice(0, reminders.length, {
    _id: '444444444444444444444444',
    title: 'Medication dose',
    type: 'Medication',
    scheduledAt: '2026-10-09T04:00:00Z',
    completed: false,
  });
  await page.evaluate(() =>
    localStorage.removeItem('pawfolio-popup-alerts-alert-user'),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setSystemTime(new Date('2026-10-09T03:29:00Z'));
  await page.reload();
  await page.locator('.schedule-board').waitFor();
  assert.equal(await page.locator('.reminder-toast').count(), 0);
  await page.getByRole('button', { name: 'Add reminder', exact: true }).click();
  const timing = page.getByLabel('Remind me in advance', { exact: true });
  const type = page.getByLabel('Reminder type', { exact: true });
  assert.equal(await timing.inputValue(), '1440');
  await type.selectOption('Medication');
  assert.equal(await timing.inputValue(), '30');
  await type.selectOption('Grooming');
  assert.equal(await timing.inputValue(), '1440');
  await timing.selectOption('0');
  await type.selectOption('Medication');
  assert.equal(await timing.inputValue(), '0');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.clock.runFor(61000);
  await page.locator('.reminder-toast').waitFor();
  assert.match(
    await page.locator('.reminder-toast h2').textContent(),
    /Upcoming/,
  );
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.reload();
  await page.locator('.schedule-board').waitFor();
  await page.clock.runFor(16000);
  assert.equal(await page.locator('.reminder-toast').count(), 0);
  await page.clock.setSystemTime(new Date('2026-10-09T04:00:00Z'));
  await page.clock.runFor(16000);
  await page.locator('.reminder-toast').waitFor();
  assert.equal(
    (await page.locator('.reminder-toast h2').textContent()).trim(),
    'Care reminder',
  );
  assert.deepEqual(errors, []);
  console.log(
    'Passed due timing, deferred popups, draft and focus preservation, dismiss persistence, grouped alerts, mobile layout, schedule navigation, and cross-tab deduplication.',
  );
} finally {
  await browser.close();
}
