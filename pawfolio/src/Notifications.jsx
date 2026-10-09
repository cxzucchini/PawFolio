import React, { useEffect, useRef, useState } from 'react';
import { Bell, X, Check, RefreshCw } from 'lucide-react';
import { notificationItems } from './notificationItems.js';
import ReminderAlerts from './ReminderAlerts.jsx';
function savedRead(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value)
      ? value.filter((item) => typeof item === 'string').slice(-500)
      : [];
  } catch {
    return [];
  }
}
export default function Notifications({
  user,
  dog,
  vaccinations = [],
  reminders = [],
  onNavigate,
  live,
  paused = false,
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [now, setNow] = useState(Date.now());
  const storageKey = 'pawfolio-notifications-' + user.id;
  const [read, setRead] = useState(() => savedRead(storageKey));
  const container = useRef(null),
    trigger = useRef(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, []);
  useEffect(() => {
    setRead(savedRead(storageKey));
    const sync = (event) => {
      if (event.key === storageKey || event.key === null)
        setRead(savedRead(storageKey));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);
  useEffect(() => {
    setOpen(false);
    setFilter('All');
  }, [dog?._id]);
  useEffect(() => {
    const dismiss = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const items = notificationItems(vaccinations, reminders, now);
  const unread = items.filter((item) => !read.includes(item.key)).length;
  const visible =
    filter === 'Unread'
      ? items.filter((item) => !read.includes(item.key))
      : items;
  function mark(keys) {
    setRead((current) => {
      const updated = [
        ...new Set([...current, ...savedRead(storageKey), ...keys]),
      ].slice(-500);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  const syncMessage =
    live?.phase === 'offline'
      ? "You're offline. Showing the last loaded care records."
      : live?.phase === 'error'
        ? "Refresh failed. Showing saved records; we'll retry automatically."
        : live?.phase === 'syncing'
          ? 'Refreshing care records...'
          : live?.updatedAt
            ? 'Updated ' +
              new Date(live.updatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Care alerts update automatically while this page is open.';
  return (
    <div
      className="notification-center"
      ref={container}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
    >
      <button
        className="notification-trigger"
        ref={trigger}
        aria-label={'Notifications' + (unread ? ', ' + unread + ' unread' : '')}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          setOpen(!open);
          setNow(Date.now());
          if (!open) live?.refreshNow();
        }}
      >
        <Bell size={20} />
        {unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <section
          className="notification-panel"
          id="notification-panel"
          aria-label="Notifications"
        >
          <div className="notification-heading">
            <h2>Notifications</h2>
            <button
              className="icon-button"
              aria-label="Close notifications"
              onClick={close}
            >
              <X size={18} />
            </button>
          </div>
          <p>
            {dog
              ? dog.name + "'s overdue care and next seven days."
              : 'Select a dog to see care notifications.'}
          </p>
          <div className="notification-sync">
            <small>{syncMessage}</small>
            <button
              className="icon-button"
              aria-label="Refresh notifications"
              disabled={live?.phase === 'syncing' || live?.phase === 'offline'}
              onClick={() => {
                setNow(Date.now());
                live?.refreshNow();
              }}
            >
              <RefreshCw
                size={16}
                className={live?.phase === 'syncing' ? 'spin' : ''}
              />
            </button>
          </div>
          <div
            className="filter-tabs notification-filters"
            aria-label="Notification filter"
          >
            {['All', 'Unread'].map((value) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? 'active' : ''}
                onClick={() => setFilter(value)}
              >
                {value} ({value === 'All' ? items.length : unread})
              </button>
            ))}
          </div>
          {unread > 0 && (
            <button
              className="notification-read"
              onClick={() => mark(items.map((item) => item.key))}
            >
              <Check size={14} /> Mark all as read
            </button>
          )}
          {visible.length ? (
            <div className="notification-items">
              {['Overdue', 'Today', 'Upcoming'].map((group) => {
                const entries = visible.filter((item) => item.group === group);
                return (
                  entries.length > 0 && (
                    <section
                      className="notification-group"
                      key={group}
                      aria-label={group + ' notifications'}
                    >
                      <h3>
                        {group} <span>{entries.length}</span>
                      </h3>
                      {entries.map((item) => (
                        <button
                          className={
                            'notification-item ' +
                            (read.includes(item.key) ? '' : 'unread')
                          }
                          key={item.key}
                          onClick={() => {
                            mark([item.key]);
                            setOpen(false);
                            onNavigate(item.route);
                          }}
                        >
                          <span>
                            {item.status}
                            {!read.includes(item.key) && (
                              <span
                                className="notification-unread-dot"
                                aria-label="Unread"
                              />
                            )}
                          </span>
                          <strong>{item.title}</strong>
                          <small>
                            {new Intl.DateTimeFormat('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                              ...(item.timed
                                ? { hour: '2-digit', minute: '2-digit' }
                                : {}),
                            }).format(
                              new Date(
                                item.timed
                                  ? item.date
                                  : item.date.slice(0, 10) + 'T12:00:00',
                              ),
                            )}
                          </small>
                        </button>
                      ))}
                    </section>
                  )
                );
              })}
            </div>
          ) : (
            <div className="notification-empty">
              <Bell size={24} />
              <strong>
                {filter === 'Unread' && items.length
                  ? 'No unread notifications.'
                  : "You're all caught up."}
              </strong>
              <p>
                {filter === 'Unread' && items.length
                  ? 'Read alerts are still available under All.'
                  : 'No overdue or upcoming care in the next seven days.'}
              </p>
            </div>
          )}
          <small className="notification-footnote">
            Reading an alert doesn't complete the reminder. Read status syncs
            between tabs in this browser.
          </small>
        </section>
      )}
      <ReminderAlerts
        user={user}
        dog={dog}
        vaccinations={vaccinations}
        reminders={reminders}
        readKeys={read}
        paused={paused || open}
        onView={(route) => {
          if (route) onNavigate(route);
          else setOpen(true);
        }}
      />
    </div>
  );
}
