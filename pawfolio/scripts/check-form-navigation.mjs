import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({
  executablePath:
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
try {
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5179/dashboard/vaccinations?designPreview=1');
  await p
    .getByRole('button', { name: 'Record vaccination', exact: true })
    .click();
  assert.equal(new URL(p.url()).searchParams.get('form'), 'vaccine');
  await p.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(new URL(p.url()).searchParams.get('form'), null);
  await p
    .getByRole('button', { name: 'Schedule appointment', exact: true })
    .click();
  assert.equal(
    new URL(p.url()).searchParams.get('form'),
    'vaccine-appointment',
  );
  await p.goBack();
  await p.locator('dialog[open]').waitFor({ state: 'detached' });
  await p.goto(
    'http://127.0.0.1:5179/dashboard/medical-history?designPreview=1',
  );
  await p.getByRole('button', { name: 'Add record', exact: true }).click();
  assert.equal(new URL(p.url()).searchParams.get('form'), 'medical');
  console.log(
    'Passed clicked form URLs, close cleanup, browser Back and medical form URLs.',
  );
} finally {
  await b.close();
}
