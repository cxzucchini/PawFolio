import BrandLogo from './BrandLogo.jsx';
import ContactPage from './ContactPage.jsx';
import React, { useEffect, useRef, useState } from 'react';
import {
  PawPrint,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  ShieldCheck,
  LoaderCircle,
} from 'lucide-react';
import { Landing } from './Landing.jsx';
import { api } from './api.js';
import Dashboard from './Dashboard.jsx';
import { dashboardView } from './dashboardRoutes.js';
import { RecoveryPage, PolicyPage, PolicyLinks } from './AccountPages.jsx';
import { validNewPassword, passwordRequirements } from '../shared/password.js';
import './app.css';
import { designPreviewEnabled } from './designPreview.js';

const validRoutes = ['/login', '/register', '/dashboard'];
export default function RootApp() {
  const [path, setPath] = useState(window.location.pathname);
  const view = dashboardView(path);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [temporaryDatabase, setTemporaryDatabase] = useState(false);
  function navigate(next) {
    if (designPreviewEnabled()) {
      const url = new URL(next, window.location.origin);
      url.searchParams.set('designPreview', '1');
      next = url.pathname + url.search + url.hash;
    }
    window.history.pushState({}, '', next);
    setPath(new URL(next, window.location.origin).pathname);
    if (next.includes('#'))
      setTimeout(
        () => document.getElementById(next.split('#')[1])?.scrollIntoView(),
        0,
      );
    else window.scrollTo(0, 0);
  }
  async function restore() {
    setConnectionError('');
    setReady(false);
    try {
      const result = await api('/auth/me');
      setUser(result.user);
      setTemporaryDatabase(result.temporaryDatabase);
    } catch (error) {
      if (error.status !== 401) setConnectionError(error.message);
      setUser(null);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    restore();
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => {
    if (!ready || connectionError) return;
    if (dashboardView(path) && !user) {
      window.history.replaceState({}, '', '/login');
      setPath('/login');
    }
    if (['/login', '/register'].includes(path) && user) {
      window.history.replaceState({}, '', '/dashboard');
      setPath('/dashboard');
    }
  }, [ready, path, user, connectionError]);
  useEffect(() => {
    const titles = {
      dashboard: 'Dashboard',
      profile: 'Dog profile',
      dogs: 'My dogs',
      vaccinations: 'Vaccinations',
      schedules: 'Schedules & reminders',
      medical: 'Medical history',
      emergency: 'Emergency vault',
      contact: 'Contact us',
    };
    document.title = view
      ? `${titles[view]} · Pawfolio`
      : path === '/login'
        ? 'Log in · Pawfolio'
        : path === '/register'
          ? 'Create an account · Pawfolio'
          : 'Pawfolio — Made for every dog';
  }, [path, view]);
  async function authenticated(result) {
    setUser(result.user);
    setConnectionError('');
    const health = await api('/health').catch(() => null);
    if (health) setTemporaryDatabase(health.temporaryDatabase);
    navigate('/dashboard');
  }
  async function logout() {
    if (designPreviewEnabled()) {
      navigate('/');
      return;
    }
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  }
  const restricted = validRoutes.includes(path) || Boolean(view);
  if (path === '/contact')
    return (
      <main className="public-contact-layout">
        <a href="/" aria-label="Pawfolio home">
          <BrandLogo tagline="" />
        </a>
        <ContactPage
          publicPage
          user={user}
          onNavigate={navigate}
          onExpired={() => navigate('/login')}
        />
        <PolicyLinks />
      </main>
    );
  if (['/terms', '/privacy', '/cookies'].includes(path))
    return <PolicyPage path={path} />;
  if (['/forgot-password', '/reset-password'].includes(path))
    return <RecoveryPage key={path} reset={path === '/reset-password'} />;
  if (restricted && !ready)
    return (
      <div className="app-loading" role="status">
        <PawPrint />
        <LoaderCircle className="spin" />
        <span>Getting Pawfolio ready…</span>
      </div>
    );
  if (restricted && connectionError)
    return (
      <div className="connection-state">
        <PawPrint />
        <h1>Let’s get you connected.</h1>
        <p>{connectionError}</p>
        <button className="button" onClick={restore}>
          Try again
        </button>
        <button className="text-link" onClick={() => navigate('/')}>
          Back to home
        </button>
      </div>
    );
  if (view)
    return user ? (
      <Dashboard
        view={view}
        user={user}
        temporaryDatabase={temporaryDatabase}
        onLogout={logout}
        onNavigate={navigate}
        onExpired={() => {
          setUser(null);
          navigate('/login');
        }}
      />
    ) : null;
  if (['/login', '/register'].includes(path))
    return user ? null : (
      <AuthPage
        mode={path === '/login' ? 'login' : 'register'}
        onNavigate={navigate}
        onAuthenticated={authenticated}
      />
    );
  return (
    <Landing
      user={user}
      onAccount={(mode) => navigate(user ? '/dashboard' : `/${mode}`)}
    />
  );
}

function AuthPage({ mode, onNavigate, onAuthenticated }) {
  const register = mode === 'register';
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef(null);
  const errorRef = useRef(null);
  useEffect(() => {
    setError('');
    setShowPassword(false);
    formRef.current?.reset();
  }, [mode]);
  async function submit(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (register && !validNewPassword(form.password)) {
      setError(passwordRequirements);
      errorRef.current?.focus();
      return;
    }
    if (register && form.password !== form.confirmPassword) {
      setError('Your passwords do not match.');
      errorRef.current?.focus();
      return;
    }
    setError('');
    setPending(true);
    try {
      await onAuthenticated(
        await api(`/auth/${mode}`, { method: 'POST', body: form }),
      );
    } catch (failure) {
      setError(failure.message);
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <button className="auth-brand" onClick={() => onNavigate('/')}>
          <BrandLogo />
        </button>
        <div className="auth-story-copy">
          <span className="eyebrow">A LITTLE MORE CARE, EVERY DAY</span>
          <h2>
            Their health.
            <br />
            Your peace
            <br />
            of <em>mind.</em>
          </h2>
          <p>
            One happy home for your dog’s health, daily routines, and all the
            important details.
          </p>
          <div className="auth-benefits">
            <span>
              <Check /> Vaccinations, organized.
            </span>
            <span>
              <Check /> Routines, remembered.
            </span>
            <span>
              <Check /> Their story, together.
            </span>
          </div>
        </div>
        <div className="auth-story-paw" aria-hidden="true">
          <PawPrint fill="currentColor" />
        </div>
        <small>Made for the dogs you call family.</small>
      </aside>
      <main className="auth-main">
        <button className="back-home" onClick={() => onNavigate('/')}>
          <ArrowLeft size={16} /> Back to home
        </button>
        <div className="auth-form-wrap">
          <span className="icon-box peach">
            <PawPrint fill="currentColor" />
          </span>
          <span className="eyebrow">
            {register ? 'START YOUR PAWFOLIO' : 'GOOD TO SEE YOU AGAIN'}
          </span>
          <h1>{register ? 'A home for their story.' : 'Welcome back.'}</h1>
          <p>
            {register
              ? 'Create your account. Then let’s meet your dog.'
              : 'Log in to pick up where you and your dog left off.'}
          </p>
          <form ref={formRef} onSubmit={submit} key={mode}>
            <fieldset disabled={pending}>
              {register ? (
                <>
                  <div className="form-grid">
                    <label>
                      First name
                      <input
                        name="firstName"
                        autoComplete="given-name"
                        required
                        maxLength={60}
                        placeholder="First name"
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        name="lastName"
                        autoComplete="family-name"
                        required
                        maxLength={60}
                        placeholder="Last name"
                      />
                    </label>
                  </div>
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    Username
                    <input
                      aria-label="Username"
                      aria-describedby="username-help"
                      name="username"
                      autoComplete="username"
                      required
                      pattern="[a-zA-Z0-9_]{3,30}"
                      minLength={3}
                      maxLength={30}
                      placeholder="Choose a username"
                    />
                    <small id="username-help">
                      3–30 letters, numbers, or underscores.
                    </small>
                  </label>
                </>
              ) : (
                <label>
                  Email or username
                  <input
                    name="identity"
                    autoComplete="username"
                    required
                    maxLength={254}
                    placeholder="you@example.com"
                  />
                </label>
              )}
              <label>
                Password
                <div className="password-input">
                  <input
                    aria-label="Password"
                    aria-describedby={register ? 'password-help' : undefined}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      register ? 'new-password' : 'current-password'
                    }
                    required
                    minLength={register ? 10 : undefined}
                    maxLength={128}
                    placeholder={
                      register ? 'At least 10 characters' : 'Your password'
                    }
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {register && (
                  <small id="password-help">{passwordRequirements}</small>
                )}
              </label>
              {register && (
                <label>
                  Confirm password
                  <input
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={10}
                    maxLength={128}
                    placeholder="Enter your password again"
                  />
                </label>
              )}
              {!register && (
                <a className="recovery-back" href="/forgot-password">
                  Forgot password?
                </a>
              )}
              {register && (
                <label className="terms-accept">
                  <input type="checkbox" required /> I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noreferrer">
                    terms & conditions
                  </a>{' '}
                  and have read the{' '}
                  <a href="/privacy" target="_blank" rel="noreferrer">
                    privacy policy
                  </a>
                  .
                </label>
              )}
              <div
                ref={errorRef}
                tabIndex={-1}
                className={error ? 'form-error' : ''}
                role={error ? 'alert' : undefined}
              >
                {error}
              </div>
              <button className="button auth-submit" type="submit">
                {pending ? (
                  <>
                    <LoaderCircle size={18} className="spin" />{' '}
                    {register ? 'Creating your account…' : 'Logging in…'}
                  </>
                ) : (
                  <>
                    {register ? 'Create account' : 'Log in'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </fieldset>
          </form>
          <p className="auth-switch">
            {register ? 'Already part of Pawfolio?' : 'New to Pawfolio?'}{' '}
            <button
              onClick={() => onNavigate(register ? '/login' : '/register')}
            >
              {register ? 'Log in' : 'Create an account'}
            </button>
          </p>
          <span className="auth-security">
            <ShieldCheck size={15} /> A thoughtful start to better dog care.
          </span>
        </div>
      </main>
    </div>
  );
}
