import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, ArrowRight } from 'lucide-react';
import { popupNotificationItems } from './notificationItems.js';

function savedAlerts(key) {
  try {
    const entries = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(entries)
      ? entries.filter((value) => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}
// Advance and due alerts each have a separate receipt for one occurrence.
function occurrence(item) {
  return item.timed
    ? item.key.replace(/-(Overdue|Today|Upcoming)$/, '')
    : item.key;
}
export default function ReminderAlerts({
  user,
  dog,
  vaccinations,
  reminders,
  readKeys,
  paused,
  onView,
}) {
  const storageKey = `pawfolio-popup-alerts-${user.id}`;
  const [now, setNow] = useState(Date.now());
  const [blocked, setBlocked] = useState(false);
  const [alert, setAlert] = useState(null);
  const [revision, setRevision] = useState(0);
  const [memory, setMemory] = useState([]);
  useEffect(() => {
    const check = () => {
      setBlocked(
        document.visibilityState === 'hidden' ||
          Boolean(document.querySelector('dialog[open]')),
      );
      setNow(Date.now());
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    const timer = setInterval(check, 15000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    check();
    return () => {
      observer.disconnect();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  useEffect(() => {
    setAlert(null);
    setMemory([]);
    const sync = (event) => {
      if (event.key === storageKey || event.key === null)
        setRevision((value) => value + 1);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey, dog?._id]);
  const eligible = popupNotificationItems(vaccinations, reminders, now).filter(
    (item) => !readKeys.includes(item.key),
  );
  const fingerprint = eligible.map(occurrence).join('|');
  useEffect(() => {
    if (paused || blocked || alert || !dog) return;
    let active = true;
    const claim = () => {
      if (
        !active ||
        document.visibilityState === 'hidden' ||
        document.querySelector('dialog[open]')
      )
        return;
      const shown = new Set([...savedAlerts(storageKey), ...memory]);
      const fresh = eligible.filter((item) => !shown.has(occurrence(item)));
      if (!fresh.length) return;
      const keys = fresh.map(occurrence);
      const updated = [...shown, ...keys].slice(-1000);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      setMemory(updated);
      setAlert(keys);
    };
    // Coordinate visible tabs so only one claims each alert.
    if (navigator.locks?.request)
      navigator.locks.request(storageKey, claim).catch(() => {
        if (active) claim();
      });
    else claim();
    return () => {
      active = false;
    };
  }, [fingerprint, paused, blocked, alert, storageKey, revision, dog?._id]);
  const current = alert
    ? eligible.filter((item) => alert.includes(occurrence(item)))
    : [];
  useEffect(() => {
    if (alert && !current.length) setAlert(null);
  }, [alert, current.length]);
  if (!current.length || paused || blocked) return null;
  const scheduleOnly = current.every((item) => item.timed);
  const vaccineOnly = current.every((item) => !item.timed);
  const route = scheduleOnly
    ? '/dashboard/schedules'
    : vaccineOnly
      ? '/dashboard/vaccinations'
      : null;
  return createPortal(
    <aside
      className="reminder-toast"
      aria-label="Care reminder"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="reminder-toast-heading">
        <span className="icon-box peach">
          <Bell size={20} />
        </span>
        <div>
          <small>{dog.name}'s care</small>
          <h2>
            {current.every((item) => item.group === 'Advance')
              ? current.length === 1
                ? 'Upcoming care reminder'
                : `${current.length} upcoming care reminders`
              : current.length === 1
                ? 'Care reminder'
                : `${current.length} care reminders`}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Dismiss reminder alert"
          onClick={() => setAlert(null)}
        >
          <X size={18} />
        </button>
      </div>
      <ul>
        {current.slice(0, 3).map((item) => (
          <li key={item.key}>
            <strong>{item.title}</strong>
            <span>{item.status}</span>
            <time dateTime={item.date}>
              {new Intl.DateTimeFormat('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric',
                ...(item.timed ? { hour: '2-digit', minute: '2-digit' } : {}),
              }).format(
                new Date(
                  item.timed ? item.date : item.date.slice(0, 10) + 'T12:00:00',
                ),
              )}
            </time>
          </li>
        ))}
      </ul>
      {current.length > 3 && (
        <p>And {current.length - 3} more in your notifications.</p>
      )}
      <div className="reminder-toast-actions">
        <button className="subtle-button" onClick={() => setAlert(null)}>
          Dismiss
        </button>
        <button
          className="button compact"
          onClick={() => {
            setAlert(null);
            onView(route);
          }}
        >
          {scheduleOnly
            ? 'View schedule'
            : vaccineOnly
              ? 'View vaccinations'
              : 'View notifications'}
          <ArrowRight size={16} />
        </button>
      </div>
    </aside>,
    document.body,
  );
}
