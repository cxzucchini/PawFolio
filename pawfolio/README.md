# Pawfolio

A dog-only MERN application. Pawfolio manages dog profiles, vaccination records, appointments, medical history, emergency details, and in-app care reminders.

## Run locally

```sh
npm install
npm run dev
```

Open the Vite URL printed in the terminal, normally `http://127.0.0.1:5173`. This starts both React/Vite and the Express API on port 4000. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

Login or registration is required to access the dashboard in local development and production. The temporary preview bypass has been removed and existing demo sessions no longer grant access.

Without `MONGODB_URI`, a real temporary development MongoDB starts automatically. The first start may download a MongoDB binary. **Accounts and records reset when the server stops.** The dashboard displays a notice in this mode.

For persistent data, create `.env`, set `MONGODB_URI` to your local MongoDB or Atlas connection string, and restart the server. Never commit `.env`.

## Vercel preview

Deploy from the repository root using Vite. Set `MONGODB_URI` in Vercel Environment Variables and `CLIENT_ORIGIN` to the exact deployed origin (for example, `https://paw-folio.vercel.app`). Atlas must allow connections from the deployment environment. The `/api` function connects to Atlas and the frontend routes use SPA rewrites.

Vercel requires login or registration. The former `PUBLIC_PREVIEW` flag has no effect and can be removed from Vercel settings. The Atlas password remains server-only; never set a `VITE_MONGODB_URI` variable.

## Build commands

Password recovery sends a six-digit code through Gmail SMTP. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER` to the sending Gmail address, `SMTP_PASS` to a Gmail app password, and `MAIL_FROM` to that address in local `.env` and Vercel. Codes expire after 10 minutes, allow five attempts, are stored as hashes, and can be used once. Resetting a password invalidates all existing sessions. Recovery returns an unavailable message until email is configured. Policy pages describe current behavior; the operator's privacy-request contact still needs configuring before a public launch.

```sh
npm run build
```

## Included

- Responsive public landing page, registration, login with email or username, protected dashboard, session restoration, and logout.
- Add/edit dog profiles, switch between dogs, and view details.
- Dashboard counts from saved vaccination, grooming, and reminder records.
- Record administered vaccine doses, search by vaccine/clinic/veterinarian, and filter All, Administered, Upcoming, or Overdue. Next due dates are optional for past doses. Schedule vaccination appointments separately as timed vet-visit reminders.
- Grooming appointments with scheduling, completion tracking, editing, and deletion.
- Add dated reminders and mark them complete or incomplete.
- Background refresh every 15 seconds while visible, with refresh on focus, reconnect, and changes from another tab. Open forms pause refresh, and failures retain the last loaded records.
- Notifications group overdue, due-today, and upcoming care. Unread status syncs across tabs in the same browser; escalating alerts become unread again.
- In-app reminder popups appear for due schedules and overdue care while the dashboard is open. Popups wait for forms to close, group multiple alerts, and remember shown occurrences across reloads and tabs. Dismissing or viewing a popup does not complete the reminder.
- New accounts start empty. No fabricated dog records are inserted.

Medical history includes saved vet visits, treatments, surgery notes, and lab summaries with search and category filters. Emergency vault stores editable contacts, clinic details, allergies, medications, conditions, and caregiver instructions for each dog. Dog and care records support editing/deletion and photo attachments with full-view previews. Public and authenticated contact forms send email. Password recovery is implemented; email verification is not included.

## Verification and production

`npm test` runs API integration tests against isolated temporary MongoDB. `npm run dev:client` and `npm run dev:server` start each service separately.

For notification and live-update browser checks, start `npm run dev:client -- --port 5179`, then run `node scripts/check-live-updates.mjs`. The check mocks API data and does not modify real accounts. Set `CHROME_PATH` for a different Chromium browser or `BASE_URL` for a different preview address.

Run `node scripts/check-reminder-alerts.mjs` against that same preview to check popup timing, draft preservation, dismissal, mobile sizing, and cross-tab deduplication. These are in-app alerts, not browser push notifications when the site is closed.

For production, set `NODE_ENV=production`, `MONGODB_URI`, and `CLIENT_ORIGIN` to your exact app origin; run `npm run build` followed by `npm start`. Serve via HTTPS and a reverse proxy to the loopback-bound Node server. Production session cookies require HTTPS. Temporary MongoDB is disabled in production. Vercel deployment is configured in vercel.json.

Passwords use salted scrypt. Sessions use opaque random tokens in HttpOnly SameSite cookies; MongoDB stores token hashes. API requests validate data, enforce dog ownership, rate-limit authentication, and reject cross-origin writes. Sessions expire after seven days.

`src/main.jsx` is the React entry point. `src/Landing.jsx` contains the public page; `src/RootApp.jsx` handles navigation and account screens; `src/Dashboard.jsx` contains the dashboard and dialogs. The Express routes, MongoDB models, and startup are in `server/`.

The Unsplash dog photo and Google Fonts are stored locally in `public/`, with a paw icon and sans-serif fallbacks. Font licenses are included in `public/fonts/`.

The approved logo is in `public/pawfolio-logo.svg`. Its original shapes and `#EE7752` color are preserved. Separate assets: `public/pawfolio-icon.svg` and `public/pawfolio-wordmark.svg`. `BrandLogo` supports `full`, `icon`, and `wordmark` variants. The favicon uses the approved paw icon.

Schedule pop-ups support advance timing: vet visits and grooming default to 1 day before, medication to 30 minutes before, and other reminders to due time only. Users can select due time only, 15 or 30 minutes, 1 hour, or 1 or 2 days before in the add/edit form. Advance and due alerts have separate receipts, so dismissing an early alert does not prevent the due alert. Pop-ups require Pawfolio to be open.

## Submission status

The sending Google account has been restored and local SMTP authentication passed. Live contact and password-reset inbox delivery still need confirmation after updating Vercel credentials and redeploying.
