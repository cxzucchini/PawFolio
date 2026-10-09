const base = process.env.BASE_URL || 'http://127.0.0.1:5179';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
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
  let requests = 0,
    fail = false;
  let reminders = [
    {
      _id: '222222222222222222222222',
      title: 'Grooming due',
      type: 'Grooming',
      scheduledAt: '2026-10-08T10:00:00Z',
      completed: false,
    },
  ];
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let status = 200,
      data = {};
    if (path.endsWith('/auth/me'))
      data = {
        user: { id: 'live-user', firstName: 'Jay', email: 'jay@example.com' },
      };
    else if (path === '/api/dogs') data = { dogs: [dog] };
    else if (path.endsWith('/dashboard')) {
      requests++;
      status = fail ? 503 : 200;
      data = fail
        ? { message: 'Refresh unavailable' }
        : { dog, vaccinations: [], reminders };
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-10-09T03:00:00Z') });
  await page.goto(`${base}/dashboard/schedules`);
  await page
    .getByRole('button', { name: 'Notifications, 1 unread', exact: true })
    .waitFor();
  await page.getByLabel('Search schedules', { exact: true }).fill('Grooming');
  reminders.push({
    _id: '333333333333333333333333',
    title: 'Grooming booked',
    type: 'Grooming',
    scheduledAt: '2026-10-10T10:00:00Z',
    completed: false,
  });
  await page.clock.runFor(16000);
  await page
    .getByRole('button', { name: 'Notifications, 2 unread', exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel('Search schedules', { exact: true }).inputValue(),
    'Grooming',
  );
  assert.equal(await page.locator('.reminder-row').count(), 2);
  await page.getByRole('button', { name: 'Add reminder', exact: true }).click();
  await page.locator('dialog input[name=title]').fill('Draft appointment');
  const before = requests;
  await page.clock.runFor(16000);
  assert.equal(requests, before);
  assert.equal(
    await page.locator('dialog input[name=title]').inputValue(),
    'Draft appointment',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page
    .getByRole('button', { name: 'Notifications, 2 unread', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Mark all as read', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Notifications', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Unread (0)', exact: true }).click();
  await page.getByText('No unread notifications.', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Close notifications', exact: true })
    .click();
  const second = await context.newPage();
  await second.goto(`${base}/dashboard`);
  await second.evaluate(() =>
    localStorage.removeItem('pawfolio-notifications-live-user'),
  );
  await page
    .getByRole('button', { name: 'Notifications, 2 unread', exact: true })
    .waitFor();
  await page.bringToFront();
  fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page
    .getByText(
      'Live refresh failed. Your records are still visible; we’ll retry automatically.',
      { exact: true },
    )
    .waitFor();
  assert.equal(await page.locator('.reminder-row').count(), 2);
  fail = false;
  await page.getByRole('button', { name: 'Retry refresh' }).click();
  await page.locator('.live-update-warning').waitFor({ state: 'hidden' });
  await context.setOffline(true);
  await page
    .getByText('You’re offline. Your last loaded records are still visible.', {
      exact: true,
    })
    .waitFor();
  await context.setOffline(false);
  await page.locator('.live-update-warning').waitFor({ state: 'hidden' });
  reminders[0].completed = true;
  await second.evaluate(async () => {
    const { api } = await import('/src/api.js');
    await api('/dogs/example/reminders/example', {
      method: 'PATCH',
      body: { completed: true },
    });
  });
  await page
    .getByRole('button', { name: 'Notifications, 1 unread', exact: true })
    .waitFor();
  const items = await page.evaluate(async () => {
    const { notificationItems } = await import('/src/notificationItems.js');
    const reminder = {
      _id: 'x',
      title: 'Medication',
      type: 'Medication',
      scheduledAt: '2026-10-09T04:00:00Z',
    };
    return [
      notificationItems([], [reminder], Date.parse('2026-10-09T03:00:00Z'))[0],
      notificationItems([], [reminder], Date.parse('2026-10-09T05:00:00Z'))[0],
    ];
  });
  assert.equal(items[0].group, 'Today');
  assert.equal(items[1].group, 'Overdue');
  assert.notEqual(items[0].key, items[1].key);
  await second.close();
  await page.setViewportSize({ width: 390, height: 900 });
  await page
    .getByRole('button', { name: 'Notifications, 1 unread', exact: true })
    .click();
  const panel = await page.locator('.notification-panel').boundingBox();
  assert(panel.x >= 0 && panel.x + panel.width <= 390);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    'Passed polling, preserved filters and drafts, cross-tab read/data updates, offline recovery, refresh failure retention, and alert escalation.',
  );
} finally {
  await browser.close();
}
