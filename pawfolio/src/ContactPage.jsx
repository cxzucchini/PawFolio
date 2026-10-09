import React, { useState } from 'react';
import { Mail, LoaderCircle, Check } from 'lucide-react';
import { api } from './api.js';

export default function ContactPage({
  user,
  onNavigate,
  onExpired,
  publicPage = false,
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    setError('');
    setSuccess('');
    setPending(true);
    try {
      const result = await api(publicPage ? '/contact/public' : '/contact', {
        method: 'POST',
        body: Object.fromEntries(new FormData(form)),
      });
      setSuccess(result.message);
      form.reset();
      setMessage('');
    } catch (failure) {
      if (failure.status === 401) onExpired();
      else setError(failure.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="dash-panel contact-panel">
      <span className="icon-box peach">
        <Mail />
      </span>
      <h2>We’re here to help.</h2>
      <p>Ask a question, report a problem, or share an idea for Pawfolio.</p>
      <p className="contact-reply">
        {publicPage ? (
          'Leave your email so we can reply.'
        ) : (
          <>
            We’ll reply to <strong>{user.email}</strong>.
          </>
        )}
      </p>
      <form className="contact-form" onSubmit={submit}>
        <fieldset disabled={pending}>
          {publicPage && (
            <div className="form-grid">
              <label>
                Your name
                <input
                  name="name"
                  required
                  maxLength={120}
                  autoComplete="name"
                  defaultValue={
                    user
                      ? `${user.firstName} ${user.lastName || ''}`.trim()
                      : ''
                  }
                />
              </label>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  defaultValue={user?.email || ''}
                />
              </label>
            </div>
          )}
          <label>
            Topic
            <select name="topic">
              <option>General question</option>
              <option>Account help</option>
              <option>Report a problem</option>
              <option>Feedback</option>
            </select>
          </label>
          <label>
            Subject
            <input
              name="subject"
              required
              maxLength={120}
              placeholder="What can we help with?"
            />
          </label>
          <label>
            Message
            <textarea
              aria-label="Message"
              name="message"
              required
              minLength={10}
              maxLength={3000}
              rows={6}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-describedby="contact-message-help"
              placeholder="Tell us what happened or what you’d like to know."
            />
          </label>
          <small id="contact-message-help">
            {message.length}/3,000 characters. Please leave out passwords and
            reset codes.
          </small>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="dashboard-notice" role="status">
              <Check size={18} />
              {success}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="subtle-button"
              onClick={() => onNavigate('/#help')}
            >
              Help & FAQs
            </button>
            <button type="submit" className="button">
              {pending ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Sending…
                </>
              ) : (
                'Send message'
              )}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
