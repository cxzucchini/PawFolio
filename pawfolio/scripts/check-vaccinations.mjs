import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  executablePath:
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
try {
  const page = await browser.newPage();
  const dog = {
    _id: '111111111111111111111111',
    name: 'Scott',
    breed: 'Poodle',
    dateOfBirth: '2022-01-01',
  };
  const vaccinations = [
    {
      _id: '222222222222222222222222',
      name: 'Rabies',
      dateAdministered: '2024-01-01',
      nextDueDate: null,
      veterinarian: 'Dr Test',
      clinic: 'Clinic',
    },
  ];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith('/auth/me')
        ? { user: { id: 'test', firstName: 'Jay' } }
        : path === '/api/dogs'
          ? { dogs: [dog] }
          : { dog, vaccinations, reminders: [] },
    });
  });
  await page.goto('http://127.0.0.1:5179/dashboard/vaccinations');
  await page.getByText('Next due date not set', { exact: true }).waitFor();
  assert.equal(await page.locator('.reminder-toast').count(), 0);
  await page.getByRole('searchbox').fill('Dr Test');
  assert.equal(await page.locator('.record-row').count(), 1);
  await page.getByRole('searchbox').fill('missing');
  await page.getByText('No matching vaccinations.', { exact: true }).waitFor();
  await page.getByRole('searchbox').fill('');
  await page
    .getByRole('button', { name: 'Edit vaccination: Rabies', exact: true })
    .click();
  assert.equal(
    await page.locator('dialog input[name=nextDueDate]').inputValue(),
    '',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'Record vaccination', exact: true })
    .click();
  assert.equal(
    await page.locator('dialog input[name=dateAdministered]').inputValue(),
    '',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'Schedule appointment', exact: true })
    .click();
  await page
    .getByRole('heading', {
      name: 'Schedule vaccination appointment.',
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.locator('dialog input[name=dateAdministered]').count(),
    0,
  );
  assert.equal(
    await page.locator('dialog input[name=type]').inputValue(),
    'Vet visit',
  );
  assert.equal(
    await page.getByLabel('Remind me in advance', { exact: true }).inputValue(),
    '1440',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(
    await page
      .getByRole('searchbox')
      .evaluate((node) => getComputedStyle(node).borderRadius),
    '8px',
  );
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    'Passed vaccination history rendering, no false alerts, veterinarian search, empty results, editing and mobile width.',
  );
} finally {
  await browser.close();
}
