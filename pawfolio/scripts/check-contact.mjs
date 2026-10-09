import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({
  executablePath:
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
try {
  const p = await b.newPage();
  let failure = true;
  let submitted;
  await p.route('**/api/**', (r) => {
    if (r.request().url().endsWith('/contact/public')) {
      submitted = r.request().postDataJSON();
      return r.fulfill({
        status: failure ? 503 : 200,
        json: {
          message: failure
            ? 'Your message could not be sent. Please try again. Your text has been kept.'
            : 'Your message has been sent. We will reply to your email.',
        },
      });
    }
    return r.fulfill({ status: 401, json: { message: 'Not logged in' } });
  });
  await p.goto('http://127.0.0.1:5179/contact');
  await p.getByLabel('Your name').fill('Jay');
  await p.getByLabel('Email address').fill('jay@example.com');
  await p.getByLabel('Subject').fill('Account question');
  await p
    .getByLabel('Message', { exact: true })
    .fill('Please help with my account.');
  await p.getByRole('button', { name: 'Send message', exact: true }).click();
  await p.getByRole('alert').waitFor();
  assert.equal(
    await p.getByLabel('Message', { exact: true }).inputValue(),
    'Please help with my account.',
  );
  failure = false;
  await p.getByRole('button', { name: 'Send message', exact: true }).click();
  await p.getByRole('status').waitFor();
  assert.equal(submitted.email, 'jay@example.com');
  assert.equal(submitted.topic, 'General question');
  assert.equal(await p.getByLabel('Message', { exact: true }).inputValue(), '');
  await p.setViewportSize({ width: 390, height: 900 });
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  console.log(
    'Passed contact submission payload, failure draft preservation, retry, success reset, and mobile width.',
  );
} finally {
  await b.close();
}
