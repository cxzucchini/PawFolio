import React, { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo.jsx';
import { api } from './api.js';
import { validNewPassword, passwordRequirements } from '../shared/password.js';

export function PolicyLinks() {
  return (
    <nav className="policy-links" aria-label="Policies">
      <a href="/terms">Terms & conditions</a>
      <a href="/privacy">Privacy policy</a>
      <a href="/cookies">Cookie policy</a>
    </nav>
  );
}
export function RecoveryPage({ reset }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [resetComplete, setResetComplete] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState(() => {
    try {
      return sessionStorage.getItem('pawfolio-recovery-email') || '';
    } catch {
      return '';
    }
  });
  const [cooldown, setCooldown] = useState(reset ? 60 : 0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function resend() {
    if (pending || cooldown) return;
    setPending(true);
    setError('');
    try {
      const result = await api('/auth/forgot-password', {
        method: 'POST',
        body: { email },
      });
      setCooldown(60);
      setMessage(result.message);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (reset && !validNewPassword(values.password)) {
      setError(passwordRequirements);
      return;
    }
    if (reset && values.password !== values.confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }
    setPending(true);
    try {
      const result = await api(
        `/auth/${reset ? 'reset-password' : 'forgot-password'}`,
        {
          method: 'POST',
          body: reset
            ? {
                email: values.email,
                code: values.code,
                password: values.password,
              }
            : { email: values.email },
        },
      );
      if (reset) {
        try {
          sessionStorage.removeItem('pawfolio-recovery-email');
        } catch {}
        setResetComplete(true);
        setMessage(result.message);
      } else {
        try {
          sessionStorage.setItem('pawfolio-recovery-email', values.email);
        } catch {}
        window.location.assign('/reset-password');
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="account-page">
      <a href="/" aria-label="Pawfolio home">
        <BrandLogo />
      </a>
      <section className="account-card auth-form-wrap">
        <span className="eyebrow">BACK TO THEIR HAPPY HOME</span>
        <h1>{reset ? 'Choose a new password' : 'Forgot your password?'}</h1>
        <p>
          {reset
            ? passwordRequirements
            : 'Enter your account email and we’ll send a six-digit reset code.'}
        </p>
        {resetComplete ? (
          <div role="status">
            <p>{message}</p>
            <a className="button" href={reset ? '/login' : '/reset-password'}>
              {reset ? 'Back to login' : 'Enter reset code'}
            </a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={pending}>
              {reset ? (
                <>
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <label>
                    Reset code
                    <input
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      required
                      minLength={6}
                      maxLength={6}
                    />
                  </label>
                  <label>
                    New password
                    <input
                      aria-describedby="reset-password-help"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={10}
                      maxLength={128}
                    />
                  </label>
                  <small id="reset-password-help">{passwordRequirements}</small>
                  <label>
                    Confirm new password
                    <input
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={10}
                      maxLength={128}
                    />
                  </label>
                </>
              ) : (
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
              )}
              {message && <p role="status">{message}</p>}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button" type="submit">
                {pending
                  ? 'Please wait…'
                  : reset
                    ? 'Save new password'
                    : 'Send reset code'}
              </button>
            </fieldset>
          </form>
        )}
        {reset && !resetComplete && (
          <button
            className="recovery-resend"
            type="button"
            disabled={pending || cooldown > 0 || !email}
            onClick={resend}
          >
            {cooldown ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        )}
        <a className="recovery-back" href="/login">
          Back to login
        </a>
      </section>
      <PolicyLinks />
    </main>
  );
}
const policies = {
  '/terms': {
    title: 'Terms & conditions',
    sections: [
      [
        'Using Pawfolio',
        'Pawfolio helps you organize dog profiles, vaccination dates, medical notes, grooming appointments, and emergency details. Keep your entries accurate and use the service lawfully.',
      ],
      [
        'Your account',
        'Keep your password private. You are responsible for activity through your account. Do not access another person’s records or upload information you do not have permission to use.',
      ],
      [
        'Care information',
        'Pawfolio is a record organizer. It does not diagnose conditions, prescribe treatment, or replace veterinary advice. Contact a veterinarian for care decisions and emergencies.',
      ],
      [
        'Availability and your records',
        'Features may change or be temporarily unavailable. Keep your own copies of important records. Do not rely on Pawfolio as your only source of emergency information.',
      ],
      [
        'Changes and questions',
        'This page describes the current service and may be updated as Pawfolio develops. For general product questions, use the repository’s issue tracker; do not post passwords, personal information, or private records there.',
      ],
    ],
  },
  '/privacy': {
    title: 'Privacy policy',
    sections: [
      [
        'Information stored',
        'We store account information you submit, including name, email, username, optional registration details, and a salted password hash. We also store your dog profiles, vaccinations, reminders, grooming reminders, medical notes, and emergency contacts.',
      ],
      [
        'How information is used',
        'This information lets you sign in, manage your dogs, restore sessions, and recover your password. Reset emails are sent to your registered address through the configured email provider. Passwords are stored as salted hashes, not plain text.',
      ],
      [
        'Service providers',
        'The deployed app uses Vercel for hosting and MongoDB Atlas for database storage. Hosting providers may process request metadata and operational logs. A configured SMTP provider processes password-reset email delivery.',
      ],
      [
        'Sessions and retention',
        'Session tokens expire after seven days. Password-reset codes expire after 10 minutes and are single-use. Account and care records remain in the database until removed; there is currently no self-service account-deletion feature.',
      ],
      [
        'Your choices',
        'You can edit supported dog and care details and log out to end your current session. Provide only information needed for your dog’s care. A dedicated privacy-request contact and account-deletion workflow have not yet been configured.',
      ],
    ],
  },
  '/cookies': {
    title: 'Cookie policy',
    sections: [
      [
        'Essential session cookie',
        'Pawfolio uses pawfolio_session to keep you signed in. It expires after seven days. It is HttpOnly and SameSite=Strict, and uses Secure in production so it is sent over HTTPS.',
      ],
      [
        'What it contains',
        'The cookie contains an opaque random session token. Your password and dog records are not stored in the cookie. The database stores a hash of the session token.',
      ],
      [
        'Managing cookies',
        'Logging out clears the session cookie. You can also delete or block cookies in your browser, but blocking this cookie prevents authenticated features from working.',
      ],
      [
        'Other storage',
        'The app currently adds no advertising or analytics cookies. Hosting platform tools may have their own behavior. Photos and fonts are served from the app’s own assets.',
      ],
    ],
  },
};
export function PolicyPage({ path }) {
  const policy = policies[path];
  return (
    <main className="policy-page">
      <a href="/" aria-label="Pawfolio home">
        <BrandLogo />
      </a>
      <article className="account-card">
        <span className="eyebrow">PAWFOLIO POLICIES</span>
        <h1>{policy.title}</h1>
        <p className="policy-date">Last updated October 6, 2026</p>
        {policy.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <a className="text-link" href="/">
          Back to home
        </a>
      </article>
      <PolicyLinks />
    </main>
  );
}
