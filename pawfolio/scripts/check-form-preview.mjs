import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({
  executablePath:
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
try {
  const p = await b.newPage();
  p.setDefaultTimeout(3000);
  for (const [section, form] of [
    ['dog-profile', 'add-dog'],
    ['dog-profile', 'edit-dog'],
    ['vaccinations', 'vaccine'],
    ['vaccinations', 'vaccine-appointment'],
    ['schedules', 'reminder'],
    ['schedules', 'grooming'],
    ['medical-history', 'medical'],
    ['emergency-vault', 'emergency'],
  ]) {
    await p.goto(
      `http://127.0.0.1:5179/dashboard/${section}?designPreview=1&form=${form}`,
    );
    await p.locator('dialog[open]').waitFor();
    assert.equal(await p.locator('dialog[open]').count(), 1);
    console.log('PASS', form);
  }
} finally {
  await b.close();
}
