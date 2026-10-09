import ScheduleBoard from './ScheduleBoard.jsx';
import useFormUrl from './useFormUrl.js';
import { designPreviewEnabled } from './designPreview.js';
import useLiveRefresh from './useLiveRefresh.js';
import {
  advanceOptions,
  defaultAdvance,
  advanceMinutes,
  advanceLabel,
} from '../shared/reminderTiming.js';
import ContactPage from './ContactPage.jsx';
import BrandLogo from './BrandLogo.jsx';
import DogSwitcher from './DogSwitcher.jsx';
import CarePages from './CarePages.jsx';
import { dashboardRoutes } from './dashboardRoutes.js';
import Notifications from './Notifications.jsx';
import DateInput from './DateInput.jsx';
import PhotoPicker, { DogAvatar, RecordPhoto } from './PhotoPicker.jsx';
import React, { useEffect, useRef, useState } from 'react';
import {
  PawPrint,
  LayoutDashboard,
  Dog,
  Syringe,
  CalendarDays,
  ClipboardPlus,
  ShieldPlus,
  Info,
  CircleHelp,
  Mail,
  LogOut,
  Plus,
  Pencil,
  X,
  Scissors,
  Bell,
  AlertTriangle,
  ArrowRight,
  Check,
  LoaderCircle,
  Menu,
  Heart,
  ChevronDown,
} from 'lucide-react';
import { api, localDay, localDateTime, vaccineState } from './api.js';

function displayDate(value) {
  return value
    ? new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
    : 'Not added';
}
function age(value) {
  const born = new Date(value);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  )
    years--;
  return years < 1
    ? 'Under 1 year old'
    : `${years} ${years === 1 ? 'year' : 'years'} old`;
}
const nav = [
  { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard },
  { id: 'profile', title: 'Dog profile', icon: Dog },
  { id: 'dogs', title: 'My dogs', icon: PawPrint },
  { id: 'vaccinations', title: 'Vaccinations', icon: Syringe },
  { id: 'schedules', title: 'Schedules & reminders', icon: CalendarDays },
  { id: 'medical', title: 'Medical history', icon: ClipboardPlus },
  { id: 'emergency', title: 'Emergency vault', icon: ShieldPlus },
];

export default function Dashboard({
  view = 'dashboard',
  user,
  temporaryDatabase,
  onLogout,
  onNavigate,
  onExpired,
}) {
  const [dogs, setDogs] = useState([]);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useFormUrl(null);
  const [editRecord, setEditRecord] = useState(null);
  function editItem(kind, item) {
    setEditRecord(item);
    setModal(kind);
  }
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(
    () => window.matchMedia('(max-width: 650px)').matches,
  );
  const navigationToggle = useRef(null);
  const sidebar = useRef(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)');
    const update = () => {
      setMobileViewport(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobileOpen || !mobileViewport) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector('button')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      navigationToggle.current?.focus();
    };
  }, [mobileOpen, mobileViewport]);
  const [busy, setBusy] = useState(false);
  const [vaccineSearch, setVaccineSearch] = useState('');
  const requestNumber = useRef(0);
  const selectionRef = useRef('');
  const dog = data?.dog;
  useEffect(() => {
    if (!dog || !designPreviewEnabled()) return;
    const form = new URLSearchParams(window.location.search).get('form');
    if (
      [
        'add-dog',
        'edit-dog',
        'vaccine',
        'vaccine-appointment',
        'reminder',
        'grooming',
      ].includes(form)
    )
      setModal(form);
  }, [dog?._id]);
  const vaccines = data?.vaccinations || [];
  const reminders = data?.reminders || [];
  const upcoming = vaccines.filter((item) => vaccineState(item) === 'Upcoming');
  const overdue = vaccines.filter((item) => vaccineState(item) === 'Overdue');
  const activeReminders = reminders.filter((item) => !item.completed);
  const careQueue = [
    ...vaccines
      .filter((item) => item.nextDueDate)
      .map((item) => ({
        title: `${item.name} vaccination`,
        date: item.nextDueDate.slice(0, 10),
        overdue: vaccineState(item) === 'Overdue',
        timed: false,
      })),
    ...activeReminders.map((item) => ({
      title: item.title,
      date: item.scheduledAt,
      overdue: new Date(item.scheduledAt).getTime() < Date.now(),
      timed: true,
    })),
  ].sort(
    (a, b) =>
      new Date(a.timed ? a.date : `${a.date}T23:59:59`) -
      new Date(b.timed ? b.date : `${b.date}T23:59:59`),
  );
  const attentionCount = careQueue.filter((item) => item.overdue).length;
  const nextCare = careQueue.find((item) => !item.overdue);
  const nextCareDate =
    nextCare &&
    new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      ...(nextCare.timed ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(
      new Date(nextCare.timed ? nextCare.date : `${nextCare.date}T12:00:00`),
    );
  const live = useLiveRefresh(
    async (signal) => {
      const id = selectionRef.current;
      const sequence = requestNumber.current;
      try {
        const list = await api('/dogs', { signal });
        const next = list.dogs.some((item) => item._id === id)
          ? id
          : list.dogs[0]?._id || '';
        const result = next
          ? await api(`/dogs/${next}/dashboard`, { signal })
          : null;
        if (
          signal.aborted ||
          sequence !== requestNumber.current ||
          selectionRef.current !== id
        )
          return;
        setDogs(list.dogs);
        setData(result);
        selectionRef.current = next;
        setSelected(next);
      } catch (failure) {
        if (failure.status === 401) onExpired();
        throw failure;
      }
    },
    { enabled: !loading, paused: busy || Boolean(modal) },
  );
  const filteredVaccines =
    filter === 'All'
      ? vaccines
      : filter === 'Administered'
        ? vaccines.filter((item) => item.dateAdministered)
        : vaccines.filter((item) => vaccineState(item) === filter);
  const showVaccines = filteredVaccines.filter((item) =>
    [item.name, item.clinic, item.veterinarian].some((value) =>
      (value || '').toLowerCase().includes(vaccineSearch.trim().toLowerCase()),
    ),
  );

  function handleError(failure) {
    if (failure.status === 401) onExpired();
    else setError(failure.message);
  }
  async function loadDogs(preferred) {
    setLoading(true);
    setError('');
    try {
      const result = await api('/dogs');
      setDogs(result.dogs);
      const next = result.dogs.some((item) => item._id === preferred)
        ? preferred
        : result.dogs[0]?._id || '';
      selectionRef.current = next;
      setSelected(next);
      if (!next) {
        setData(null);
        setLoading(false);
      } else await loadDashboard(next);
    } catch (failure) {
      handleError(failure);
      setLoading(false);
    }
  }
  async function loadDashboard(id) {
    const sequence = ++requestNumber.current;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await api(`/dogs/${id}/dashboard`);
      if (sequence === requestNumber.current) setData(result);
    } catch (failure) {
      if (sequence === requestNumber.current) handleError(failure);
    } finally {
      if (sequence === requestNumber.current) setLoading(false);
    }
  }
  useEffect(() => {
    loadDogs();
  }, []);
  function selectDog(id) {
    selectionRef.current = id;
    setSelected(id);
    setNotice('');
    loadDashboard(id);
  }
  function selectView(id) {
    onNavigate(dashboardRoutes[id]);
    setMobileOpen(false);
    setNotice('');
    setError('');
  }
  async function save(kind, values) {
    const id = selected;
    let result;
    if (kind === 'add-dog')
      result = await api('/dogs', { method: 'POST', body: values });
    if (kind === 'edit-dog')
      result = await api(`/dogs/${id}`, { method: 'PUT', body: values });
    if (kind === 'vaccine')
      result = await api(
        `/dogs/${id}/vaccinations${editRecord ? '/' + editRecord._id : ''}`,
        {
          method: editRecord ? 'PUT' : 'POST',
          body: values,
        },
      );
    if (kind === 'reminder')
      result = await api(
        `/dogs/${id}/reminders${editRecord ? '/' + editRecord._id : ''}`,
        {
          method: editRecord ? 'PUT' : 'POST',
          body: {
            ...values,
            scheduledAt: new Date(values.scheduledAt).toISOString(),
          },
        },
      );
    setModal(null);
    setEditRecord(null);
    await loadDogs(result?.dog?._id || id);
    setNotice(
      kind === 'add-dog'
        ? `${result.dog.name} is part of your Pawfolio!`
        : 'Your changes have been saved.',
    );
  }

  async function completeReminder(item) {
    setBusy(true);
    setError('');
    const id = selected;
    try {
      const result = await api(`/dogs/${id}/reminders/${item._id}`, {
        method: 'PATCH',
        body: { completed: !item.completed },
      });
      if (selectionRef.current === id)
        setData((current) => ({
          ...current,
          reminders: current.reminders.map((reminder) =>
            reminder._id === item._id ? result.reminder : reminder,
          ),
        }));
    } catch (failure) {
      handleError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await onLogout();
    } catch (failure) {
      handleError(failure);
      setBusy(false);
    }
  }
  async function removeReminder(item) {
    if (
      busy ||
      !window.confirm(`Delete “${item.title}”? This cannot be undone.`)
    )
      return;
    const id = selected;
    setBusy(true);
    setError('');
    try {
      await api(`/dogs/${id}/reminders/${item._id}`, { method: 'DELETE' });
      if (selectionRef.current === id) {
        setData((current) => ({
          ...current,
          reminders: current.reminders.filter(
            (record) => record._id !== item._id,
          ),
        }));
        setNotice('Reminder deleted.');
      }
    } catch (failure) {
      handleError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(resource, item) {
    const name = item.name || item.title;
    if (
      busy ||
      !window.confirm(
        resource === 'dogs'
          ? 'Delete ' +
              name +
              ' and ALL their care records? This cannot be undone.'
          : 'Delete vaccination ' + name + '? This cannot be undone.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(
        resource === 'dogs'
          ? '/dogs/' + item._id
          : '/dogs/' + selected + '/vaccinations/' + item._id,
        { method: 'DELETE' },
      );
      await loadDogs(resource === 'dogs' ? '' : selected);
      setNotice(
        resource === 'dogs'
          ? 'Dog profile and care records deleted.'
          : 'Vaccination deleted.',
      );
    } catch (failure) {
      handleError(failure);
    } finally {
      setBusy(false);
    }
  }
  const VaccineList = ({ compact = false }) => (
    <div className="record-list">
      {(compact ? vaccines.slice(0, 3) : showVaccines).map((item) => (
        <div className="record-row" key={item._id}>
          <span
            className={`mini-record-icon ${vaccineState(item) === 'Overdue' ? 'peach' : 'yellow'}`}
          >
            <Syringe size={18} />
          </span>
          <div>
            <strong>{item.name}</strong>
            <small>
              {item.dateAdministered
                ? `Last given ${displayDate(item.dateAdministered)}`
                : 'Vaccination date not recorded'}
              {item.clinic ? ` · ${item.clinic}` : ''}
            </small>
            <RecordPhoto photo={item.photo} title={item.name} />
            {item.veterinarian && (
              <small>Veterinarian: {item.veterinarian}</small>
            )}
          </div>
          <div className="record-date">
            <span
              className={`record-badge ${vaccineState(item).toLowerCase()}`}
            >
              {vaccineState(item)}
            </span>
            <small>
              {item.nextDueDate
                ? `Due ${displayDate(item.nextDueDate)}`
                : 'Next due date not set'}
            </small>
            <div className="record-actions">
              <button
                className="subtle-button"
                disabled={busy}
                onClick={() => editItem('vaccine', item)}
                aria-label={`Edit vaccination: ${item.name}`}
              >
                Edit
              </button>
              <button
                className="record-delete"
                disabled={busy}
                onClick={() => removeItem('vaccinations', item)}
                aria-label={`Delete vaccination: ${item.name}`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  const ReminderList = ({ compact = false, groomingOnly = false, entries }) => {
    const matching =
      entries ||
      (groomingOnly
        ? reminders.filter((item) => item.type === 'Grooming')
        : reminders);
    const items = compact
      ? matching
      : [...matching].sort(
          (a, b) =>
            Number(a.completed) - Number(b.completed) ||
            new Date(a.scheduledAt) - new Date(b.scheduledAt),
        );
    return (
      <div className="record-list reminder-list">
        {items.map((item) => {
          const overdue =
            !item.completed && new Date(item.scheduledAt) < new Date();
          return (
            <div
              className={`reminder-row ${item.completed ? 'reminder-complete' : ''}`}
              key={item._id}
            >
              <button
                className={`complete-toggle ${item.completed ? 'checked' : ''}`}
                disabled={busy}
                onClick={() => completeReminder(item)}
                aria-pressed={item.completed}
                aria-label={`${item.completed ? 'Mark incomplete' : 'Complete'}: ${item.title}`}
              >
                {item.completed && <Check size={18} />}
              </button>
              <div className="reminder-details">
                <strong>{item.title}</strong>
                <small>
                  {item.type} · {advanceLabel(advanceMinutes(item))}
                </small>
                <time dateTime={item.scheduledAt}>
                  {displayDate(item.scheduledAt)} ·{' '}
                  {new Date(item.scheduledAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <span
                className={`reminder-status ${item.completed ? 'is-complete' : overdue ? 'is-overdue' : ''}`}
              >
                {item.completed
                  ? 'Completed'
                  : overdue
                    ? 'Overdue'
                    : 'Upcoming'}
              </span>
              <div className="record-actions">
                <button
                  className="subtle-button"
                  disabled={busy}
                  onClick={() => editItem('reminder', item)}
                  aria-label={`Edit reminder: ${item.title}`}
                >
                  Edit
                </button>
                <button
                  className="record-delete"
                  disabled={busy}
                  onClick={() => removeReminder(item)}
                  aria-label={`Delete reminder: ${item.title}`}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="dashboard-layout">
      <a className="skip-link" href="#dashboard-main">
        Skip to dashboard
      </a>
      <div className="mobile-dash-header">
        <button className="auth-brand" onClick={() => onNavigate('/')}>
          <BrandLogo tagline="" />
        </button>
        <button
          className="icon-button"
          aria-label="Toggle dashboard navigation"
          ref={navigationToggle}
          aria-expanded={mobileOpen}
          aria-controls="dashboard-sidebar"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>
      {mobileOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        inert={mobileViewport && !mobileOpen}
        role={mobileViewport && mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileViewport && mobileOpen ? true : undefined}
        aria-label="Dashboard navigation"
        onKeyDown={(event) => {
          if (!mobileViewport || !mobileOpen) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            setMobileOpen(false);
          }
          if (event.key !== 'Tab') return;
          const controls = [
            ...sidebar.current.querySelectorAll(
              'button:not(:disabled), a[href], [tabindex="0"]',
            ),
          ].filter((node) => node.getClientRects().length);
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className={`dashboard-sidebar ${mobileOpen ? 'open' : ''}`}
        id="dashboard-sidebar"
      >
        {mobileViewport && mobileOpen && (
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        )}
        <button className="auth-brand" onClick={() => onNavigate('/')}>
          <BrandLogo tagline="CANINE PASSPORT" />
        </button>
        <div className="sidebar-content">
          <DogSwitcher
            dogs={dogs}
            selected={selected}
            disabled={busy}
            onSelect={selectDog}
          />
          <nav className="dashboard-nav" aria-label="Dog care navigation">
            {nav.map(({ id, title, icon: Icon, later }) => (
              <button
                key={id}
                disabled={later}
                title={later ? 'Available in a later project stage' : undefined}
                className={view === id ? 'selected' : ''}
                aria-current={view === id ? 'page' : undefined}
                onClick={() => selectView(id)}
              >
                <Icon size={16} />
                <span>{title}</span>
                {later && <span className="soon-label">Soon</span>}
              </button>
            ))}
          </nav>
          <span className="sidebar-section-label">INFO & SUPPORT</span>
          <nav
            className="dashboard-nav support-nav"
            aria-label="Information and support"
          >
            <button onClick={() => onNavigate('/#about')}>
              <Info size={15} />
              About us
            </button>
            <button onClick={() => onNavigate('/#services')}>
              <Heart size={15} />
              Our services
            </button>
            <button
              onClick={() => {
                selectView('contact');
              }}
            >
              <Mail size={15} />
              Contact us
            </button>
            <button onClick={() => onNavigate('/#help')}>
              <CircleHelp size={15} />
              Help / FAQs
            </button>
          </nav>
        </div>
        <div className="sidebar-account">
          <span className="user-avatar">
            {user.firstName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{user.firstName}</strong>
            <small>Dog parent</small>
          </div>
          <button
            disabled={busy}
            onClick={logout}
            className="icon-button"
            aria-label="Log out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="dashboard-main" id="dashboard-main">
        <div className="dashboard-topline">
          <div>
            <span className="eyebrow">YOUR DOG’S HAPPY HOME</span>
            <h1>
              {nav.find((item) => item.id === view)?.title || 'Contact us'}
            </h1>
          </div>
          <Notifications
            paused={
              loading ||
              busy ||
              Boolean(modal) ||
              mobileOpen ||
              ['offline', 'error'].includes(live.phase)
            }
            live={live}
            user={user}
            dog={dog}
            vaccinations={vaccines}
            reminders={reminders}
            onNavigate={onNavigate}
          />
          {['dashboard', 'dogs'].includes(view) && (
            <button
              className="subtle-button topline-add-dog"
              onClick={() => setModal('add-dog')}
            >
              <Plus size={16} /> Add dog
            </button>
          )}
        </div>
        {temporaryDatabase && (
          <div className="development-note">
            <Info size={15} /> Development database: accounts and dog records
            reset when the server stops.
          </div>
        )}
        {['error', 'offline'].includes(live.phase) && (
          <div className="live-update-warning" role="status">
            <span>
              {live.phase === 'offline'
                ? 'You’re offline. Your last loaded records are still visible.'
                : 'Live refresh failed. Your records are still visible; we’ll retry automatically.'}
            </span>
            {live.phase === 'error' && (
              <button className="subtle-button" onClick={live.refreshNow}>
                Retry refresh
              </button>
            )}
          </div>
        )}
        {error && (
          <div className="dashboard-error" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button onClick={() => loadDogs(selected)}>Try again</button>
          </div>
        )}
        {notice && (
          <div className="dashboard-notice" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {loading ? (
          <div className="dashboard-loading" role="status">
            <LoaderCircle className="spin" /> Loading your dog’s details…
          </div>
        ) : view === 'contact' ? (
          <ContactPage
            user={user}
            onNavigate={onNavigate}
            onExpired={onExpired}
          />
        ) : !dogs.length ? (
          <section className="dashboard-empty">
            <div className="empty-paw">
              <PawPrint fill="currentColor" />
            </div>
            <span className="eyebrow">
              WELCOME TO PAWFOLIO, {user.firstName.toUpperCase()}
            </span>
            <h2>Let’s meet your best friend.</h2>
            <p>
              Add your first dog to start building their health story.
              Vaccinations, grooming appointments, and upcoming reminders will
              appear here.
            </p>
            <button className="button" onClick={() => setModal('add-dog')}>
              <Plus size={18} /> Add your first dog
            </button>
            <span className="empty-note">
              <ShieldPlus size={15} /> Their details are linked to your account.
            </span>
          </section>
        ) : dog ? (
          <>
            {view === 'dashboard' && (
              <>
                <section className="dashboard-welcome">
                  <div>
                    <span className="eyebrow care-update-label">
                      {dog.name}’s care update
                    </span>
                    <h2>
                      {attentionCount
                        ? `${attentionCount} overdue ${attentionCount === 1 ? 'item needs' : 'items need'} attention`
                        : nextCare
                          ? `Next: ${nextCare.title}`
                          : 'No upcoming care scheduled'}
                    </h2>
                    <p>
                      {attentionCount
                        ? `Review overdue vaccinations and reminders.${nextCare ? ` Next scheduled: ${nextCare.title} on ${nextCareDate}.` : ''}`
                        : nextCare
                          ? `Scheduled for ${nextCareDate}. Nothing overdue.`
                          : 'Add an appointment or reminder to plan the next visit.'}
                    </p>
                  </div>
                  <div className="welcome-actions">
                    <button
                      className="subtle-button"
                      onClick={() => setModal('edit-dog')}
                    >
                      <Pencil size={14} /> Edit dog
                    </button>
                    <button
                      className="button compact"
                      onClick={() => setModal('vaccine')}
                    >
                      <Plus size={14} /> Record vaccination
                    </button>
                  </div>
                </section>
                <div className="dashboard-stats">
                  <button
                    className="stat-card"
                    onClick={() => {
                      setFilter('Upcoming');
                      selectView('vaccinations');
                    }}
                  >
                    <span className="icon-box yellow">
                      <Syringe size={23} />
                    </span>
                    <div>
                      <small>Upcoming vaccines</small>
                      <strong>
                        {upcoming.length}{' '}
                        {upcoming.length === 1 ? 'Due' : 'Due'}
                      </strong>
                      <span>
                        {upcoming.length
                          ? `Next: ${displayDate(upcoming[0].nextDueDate)}`
                          : 'No upcoming doses'}
                      </span>
                    </div>
                  </button>
                  <button
                    className="stat-card"
                    onClick={() => {
                      setFilter('Overdue');
                      selectView('vaccinations');
                    }}
                  >
                    <span className="icon-box peach">
                      <AlertTriangle size={22} />
                    </span>
                    <div>
                      <small>Overdue vaccines</small>
                      <strong>
                        {overdue.length}{' '}
                        {overdue.length === 1 ? 'Action' : 'Actions'}
                      </strong>
                      <span>
                        {overdue.length
                          ? 'Review with your veterinarian'
                          : 'Nothing overdue'}
                      </span>
                    </div>
                  </button>
                  <button
                    className="stat-card"
                    onClick={() => selectView('schedules')}
                  >
                    <span className="icon-box green">
                      <Scissors size={22} />
                    </span>
                    <div>
                      <small>Grooming appointments</small>
                      <strong>
                        {
                          activeReminders.filter(
                            (item) => item.type === 'Grooming',
                          ).length
                        }{' '}
                        Planned
                      </strong>
                      <span>Keep their grooming routine on track</span>
                    </div>
                  </button>
                  <button
                    className="stat-card"
                    onClick={() => selectView('schedules')}
                  >
                    <span className="icon-box blue">
                      <CalendarDays size={22} />
                    </span>
                    <div>
                      <small>Active reminders</small>
                      <strong>
                        {activeReminders.length}{' '}
                        {activeReminders.length === 1 ? 'Task' : 'Tasks'}
                      </strong>
                      <span>
                        {activeReminders.length
                          ? 'A little planning ahead'
                          : 'No active reminders'}
                      </span>
                    </div>
                  </button>
                </div>
                <DogSummary dog={dog} onClick={() => selectView('profile')} />
                <div className="dashboard-detail-grid">
                  <section className="dash-panel">
                    <PanelHeading
                      icon={Syringe}
                      title="Vaccinations at a glance"
                      action="Record vaccination"
                      onAction={() => setModal('vaccine')}
                    />
                    {vaccines.length ? (
                      <VaccineList compact />
                    ) : (
                      <EmptyRecords
                        icon={Syringe}
                        title="A fresh start to their vaccine record."
                        text="Add a vaccine to see upcoming and overdue doses."
                      />
                    )}
                    <button
                      className="panel-link"
                      onClick={() => {
                        setFilter('All');
                        selectView('vaccinations');
                      }}
                    >
                      View all vaccinations <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="dash-panel">
                    <PanelHeading
                      icon={Scissors}
                      title="Grooming appointments"
                      action="Add grooming"
                      onAction={() => setModal('grooming')}
                    />
                    {reminders.some((item) => item.type === 'Grooming') ? (
                      <ReminderList groomingOnly />
                    ) : (
                      <EmptyRecords
                        icon={Scissors}
                        title="A little care for their coat."
                        text="Schedule a bath, haircut, nail trim, or grooming appointment."
                      />
                    )}
                  </section>
                </div>
                <section className="dash-panel reminders-panel">
                  <PanelHeading
                    icon={Bell}
                    title="Other reminders"
                    action="Add reminder"
                    onAction={() => setModal('reminder')}
                  />
                  {reminders.some((item) => item.type !== 'Grooming') ? (
                    <ReminderList
                      compact
                      entries={reminders.filter(
                        (item) => item.type !== 'Grooming',
                      )}
                    />
                  ) : (
                    <EmptyRecords
                      icon={CalendarDays}
                      title="A little room to plan ahead."
                      text="Add a vet visit, medication, or another reminder. Grooming appointments are listed above."
                    />
                  )}
                </section>
              </>
            )}
            {view === 'profile' && (
              <>
                <section className="dashboard-welcome">
                  <div>
                    <span className="eyebrow">
                      THE DETAILS THAT MAKE THEM, THEM
                    </span>
                    <h2>{dog.name}’s dog profile</h2>
                    <p>A home for the little details that matter.</p>
                  </div>
                  <button
                    className="button compact"
                    onClick={() => setModal('edit-dog')}
                  >
                    <Pencil size={15} /> Edit profile
                  </button>
                </section>
                <DogSummary dog={dog} />
                <section className="dash-panel profile-details">
                  <h2>Dog information</h2>
                  <dl>
                    {[
                      ['Name', dog.name],
                      ['Species', 'Dog'],
                      ['Breed', dog.breed],
                      ['Date of birth', displayDate(dog.dateOfBirth)],
                      ['Gender', dog.gender],
                      ['Weight', dog.weight ? `${dog.weight} kg` : 'Not added'],
                      ['Microchip number', dog.microchip || 'Not added'],
                      ['Primary veterinarian', dog.veterinarian || 'Not added'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section
                  className="profile-delete-area"
                  aria-label="Delete dog profile"
                >
                  <div>
                    <h2>Delete this profile</h2>
                    <p>
                      This permanently removes {dog.name}’s profile and all
                      their care records.
                    </p>
                  </div>
                  <button
                    className="profile-delete-button"
                    disabled={busy}
                    onClick={() => removeItem('dogs', dog)}
                  >
                    Delete dog profile
                  </button>
                </section>
              </>
            )}
            {view === 'dogs' && (
              <>
                <section className="dashboard-welcome">
                  <div>
                    <span className="eyebrow">YOUR PACK, TOGETHER</span>
                    <h2>Meet your dogs.</h2>
                    <p>Choose a dog to see their care dashboard.</p>
                  </div>
                </section>
                <div className="my-dogs-grid">
                  {dogs.map((item) => (
                    <button
                      className={`my-dog-card ${item._id === selected ? 'active' : ''}`}
                      key={item._id}
                      onClick={() => {
                        selectDog(item._id);
                        selectView('dashboard');
                      }}
                    >
                      <DogAvatar dog={item} interactive={false}>
                        <Dog size={32} />
                      </DogAvatar>
                      <strong>{item.name}</strong>
                      <span>{item.breed}</span>
                      <small>{age(item.dateOfBirth)}</small>
                      <span className="panel-link">
                        Open dashboard <ArrowRight size={15} />
                      </span>
                    </button>
                  ))}
                  <button
                    className="my-dog-card add-dog-card"
                    onClick={() => setModal('add-dog')}
                  >
                    <Plus size={32} />
                    <strong>Add another dog</strong>
                    <span>Every dog gets their own profile.</span>
                  </button>
                </div>
              </>
            )}
            {view === 'vaccinations' && (
              <>
                <section className="dashboard-welcome">
                  <div>
                    <span className="eyebrow">
                      A LITTLE PROTECTION, A LOT OF CARE
                    </span>
                    <h2>{dog.name}’s vaccinations</h2>
                    <p>Recorded doses and their next due dates.</p>
                  </div>
                  <div className="welcome-actions vaccination-actions">
                    <button
                      className="subtle-button"
                      onClick={() => setModal('vaccine-appointment')}
                    >
                      <CalendarDays size={15} /> Schedule appointment
                    </button>
                    <button
                      className="button compact"
                      onClick={() => setModal('vaccine')}
                    >
                      <Plus size={15} /> Record vaccination
                    </button>
                  </div>
                </section>
                <section className="dash-panel">
                  <div className="filter-tabs" aria-label="Filter vaccinations">
                    {['All', 'Administered', 'Upcoming', 'Overdue'].map(
                      (value) => (
                        <button
                          aria-pressed={value === filter}
                          className={value === filter ? 'active' : ''}
                          onClick={() => setFilter(value)}
                          key={value}
                        >
                          {value}
                        </button>
                      ),
                    )}
                  </div>
                  <label className="vaccine-search">
                    Search vaccinations
                    <input
                      type="search"
                      value={vaccineSearch}
                      onChange={(event) => setVaccineSearch(event.target.value)}
                      placeholder="Vaccine, clinic, or veterinarian"
                    />
                  </label>
                  <p className="filter-note">
                    “Administered” shows recorded doses. Upcoming and overdue
                    refer to the next due date.
                  </p>
                  {showVaccines.length ? (
                    <VaccineList />
                  ) : (
                    <EmptyRecords
                      icon={Syringe}
                      title={
                        vaccineSearch.trim()
                          ? 'No matching vaccinations.'
                          : `No ${filter === 'All' ? '' : filter.toLowerCase() + ' '}vaccinations yet.`
                      }
                      text={
                        vaccineSearch.trim()
                          ? 'Try another search or change the filter.'
                          : 'Record a past dose or add the next due date.'
                      }
                    />
                  )}
                </section>
              </>
            )}
            {view === 'schedules' && (
              <>
                <section className="dashboard-welcome">
                  <div>
                    <span className="eyebrow">
                      MAKE EVERY DAY A LITTLE EASIER
                    </span>
                    <h2>{dog.name}’s schedules & reminders</h2>
                    <p>Small routines and important reminders.</p>
                  </div>
                  <button
                    className="button compact"
                    onClick={() => setModal('reminder')}
                  >
                    <Plus size={15} /> Add reminder
                  </button>
                </section>
                <ScheduleBoard
                  key={selected}
                  reminders={reminders}
                  renderList={(items) => (
                    <ReminderList entries={items} compact />
                  )}
                  onAddGrooming={() => setModal('grooming')}
                />
              </>
            )}
            {['medical', 'emergency'].includes(view) && (
              <CarePages
                key={`${selected}-${view}`}
                kind={view}
                dog={dog}
                onExpired={onExpired}
              />
            )}
          </>
        ) : (
          !error && (
            <div className="dashboard-empty">
              <p>Select a dog to see their dashboard.</p>
            </div>
          )
        )}
        <div className="dashboard-footer">
          <PawPrint size={13} /> Thoughtful care, for every dog.
        </div>
      </main>
      {modal && (
        <RecordDialog
          key={`${modal}-${editRecord?._id || 'new'}`}
          record={editRecord}
          initialType={modal === 'grooming' ? 'Grooming' : undefined}
          appointment={modal === 'vaccine-appointment'}
          kind={
            ['grooming', 'vaccine-appointment'].includes(modal)
              ? 'reminder'
              : modal
          }
          dog={dog}
          onClose={() => {
            setModal(null);
            setEditRecord(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function DogSummary({ dog, onClick }) {
  return (
    <section className="dog-summary">
      <DogAvatar dog={dog}>
        <Dog size={29} />
      </DogAvatar>
      <div className="summary-dog-name">
        <h2>{dog.name}</h2>
        <p>
          {dog.breed} · {age(dog.dateOfBirth)}
        </p>
      </div>
      <div className="summary-detail">
        <span>WEIGHT</span>
        <strong>{dog.weight ? `${dog.weight} kg` : 'Not added'}</strong>
      </div>
      <div className="summary-detail">
        <span>MICROCHIP</span>
        <strong>{dog.microchip || 'Not added'}</strong>
      </div>
      <div className="summary-detail">
        <span>PRIMARY VET</span>
        <strong>{dog.veterinarian || 'Not added'}</strong>
      </div>
      {onClick && (
        <button
          className="icon-button"
          aria-label={`View ${dog.name}’s profile`}
          onClick={onClick}
        >
          <ArrowRight size={17} />
        </button>
      )}
    </section>
  );
}
function PanelHeading({ icon: Icon, title, action, onAction }) {
  return (
    <div className="panel-heading">
      <h2>
        <Icon size={18} />
        {title}
      </h2>
      {action && (
        <button onClick={onAction}>
          <Plus size={13} />
          {action}
        </button>
      )}
    </div>
  );
}
function EmptyRecords({ icon: Icon, title, text }) {
  return (
    <div className="empty-records">
      <Icon size={25} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function RecordDialog({
  kind,
  dog,
  record,
  initialType,
  appointment,
  onClose,
  onSave,
}) {
  const ref = useRef(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState(
    kind === 'edit-dog' ? dog?.photo || '' : record?.photo || '',
  );
  const [photoBusy, setPhotoBusy] = useState(false);
  const [reminderType, setReminderType] = useState(
    record?.type || initialType || 'Vet visit',
  );
  const [advance, setAdvance] = useState(
    record
      ? advanceMinutes(record)
      : defaultAdvance(initialType || 'Vet visit'),
  );
  const [customAdvance, setCustomAdvance] = useState(Boolean(record));
  const isDog = kind === 'add-dog' || kind === 'edit-dog';
  const edit = kind === 'edit-dog';
  const titles = {
    'add-dog': 'Let’s meet your dog.',
    'edit-dog': `A little update for ${dog?.name}.`,
    vaccine: record ? 'Edit vaccination.' : 'Record vaccination.',
    reminder: appointment
      ? 'Schedule vaccination appointment.'
      : record
        ? 'Edit reminder.'
        : 'Make a little plan.',
  };
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    return () => node.close();
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (photoBusy) return;
    setPending(true);
    setError('');
    try {
      await onSave(kind, {
        ...Object.fromEntries(new FormData(event.currentTarget)),
        ...(isDog || kind === 'vaccine' ? { photo } : {}),
      });
    } catch (failure) {
      setError(failure.message);
      setPending(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="record-dialog"
      aria-labelledby="record-dialog-title"
      onCancel={(event) => {
        if (pending) event.preventDefault();
        else onClose();
      }}
    >
      <button
        disabled={pending}
        className="dialog-close"
        onClick={onClose}
        aria-label="Close dialog"
      >
        <X size={21} />
      </button>
      <span className="icon-box peach">
        {isDog ? <Dog /> : kind === 'vaccine' ? <Syringe /> : <CalendarDays />}
      </span>
      <h2 id="record-dialog-title">{titles[kind]}</h2>
      <p>
        {isDog
          ? 'Start with the essentials. You can update them anytime.'
          : `A new part of ${dog?.name}’s care story.`}
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={pending}>
          {isDog && (
            <>
              <div className="form-grid">
                <label>
                  Dog’s name
                  <input
                    name="name"
                    autoFocus
                    required
                    maxLength={60}
                    defaultValue={edit ? dog.name : ''}
                    placeholder="e.g. Buster"
                  />
                </label>
                <label>
                  Breed
                  <input
                    name="breed"
                    required
                    maxLength={100}
                    defaultValue={edit ? dog.breed : ''}
                    placeholder="e.g. Golden Retriever"
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Date of birth
                  <DateInput
                    name="dateOfBirth"
                    type="date"
                    required
                    min="1990-01-01"
                    max={localDay()}
                    defaultValue={edit ? dog.dateOfBirth.slice(0, 10) : ''}
                  />
                </label>
                <label>
                  Gender
                  <select
                    name="gender"
                    defaultValue={edit ? dog.gender : 'Unknown'}
                  >
                    <option>Unknown</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </label>
              </div>
              <label>
                Weight in kg <span className="optional-label">(optional)</span>
                <input
                  name="weight"
                  type="number"
                  min="0.1"
                  max="150"
                  step="0.1"
                  defaultValue={edit ? (dog.weight ?? '') : ''}
                  placeholder="e.g. 28.5"
                />
              </label>
              <label>
                Microchip number{' '}
                <span className="optional-label">(optional)</span>
                <input
                  name="microchip"
                  maxLength={30}
                  defaultValue={edit ? dog.microchip : ''}
                  placeholder="Your dog’s microchip number"
                />
              </label>
              <label>
                Primary veterinarian{' '}
                <span className="optional-label">(optional)</span>
                <input
                  name="veterinarian"
                  maxLength={100}
                  defaultValue={edit ? dog.veterinarian : ''}
                  placeholder="e.g. Dr. Sarah Jenkins"
                />
              </label>
            </>
          )}
          {kind === 'vaccine' && (
            <>
              <label>
                Vaccine name
                <input
                  name="name"
                  required
                  autoFocus
                  maxLength={100}
                  defaultValue={record?.name || ''}
                  placeholder="e.g. Rabies"
                />
              </label>
              <div className="form-grid">
                <label>
                  Date administered{' '}
                  {record && <span className="optional-label">(optional)</span>}
                  <DateInput
                    name="dateAdministered"
                    required={!record}
                    type="date"
                    max={localDay()}
                    defaultValue={record?.dateAdministered?.slice(0, 10) || ''}
                  />
                </label>
                <label>
                  Next due date{' '}
                  <span className="optional-label">(optional)</span>
                  <DateInput
                    name="nextDueDate"
                    type="date"
                    defaultValue={record?.nextDueDate?.slice(0, 10) || ''}
                  />
                </label>
              </div>
              <p className="filter-note">
                Record a dose already given. To plan a future visit, use
                Schedule appointment.
              </p>
              <label>
                Clinic <span className="optional-label">(optional)</span>
                <input
                  name="clinic"
                  maxLength={100}
                  defaultValue={record?.clinic || ''}
                  placeholder="Clinic name"
                />
              </label>
              <label>
                Veterinarian <span className="optional-label">(optional)</span>
                <input
                  name="veterinarian"
                  maxLength={100}
                  defaultValue={
                    record ? record.veterinarian : dog?.veterinarian
                  }
                  placeholder="Veterinarian’s name"
                />
              </label>
            </>
          )}
          {kind === 'reminder' && (
            <>
              <label>
                {appointment ? 'Appointment title' : 'Reminder title'}
                <input
                  name="title"
                  required
                  autoFocus
                  maxLength={120}
                  defaultValue={record?.title || ''}
                  placeholder={
                    appointment
                      ? 'e.g. Rabies vaccination appointment'
                      : 'e.g. Annual checkup'
                  }
                />
              </label>
              {appointment ? (
                <input type="hidden" name="type" value="Vet visit" />
              ) : (
                <label>
                  Type
                  <select
                    name="type"
                    aria-label="Reminder type"
                    value={reminderType}
                    onChange={(event) => {
                      setReminderType(event.target.value);
                      if (!customAdvance)
                        setAdvance(defaultAdvance(event.target.value));
                    }}
                  >
                    <option>Vet visit</option>
                    <option>Grooming</option>
                    <option>Medication</option>
                    <option>Other</option>
                  </select>
                </label>
              )}
              <label>
                Date and time
                <DateInput
                  name="scheduledAt"
                  type="datetime-local"
                  defaultValue={
                    record
                      ? localDateTime(new Date(record.scheduledAt))
                      : localDateTime()
                  }
                  required
                />
              </label>
              <label>
                Remind me in advance
                <select
                  name="remindBeforeMinutes"
                  aria-label="Remind me in advance"
                  value={advance}
                  onChange={(event) => {
                    setAdvance(Number(event.target.value));
                    setCustomAdvance(true);
                  }}
                >
                  {advanceOptions.map(([minutes, label]) => (
                    <option key={minutes} value={minutes}>
                      {label}
                    </option>
                  ))}
                </select>
                <small className="reminder-timing-help">
                  You will also get an alert when due. Pop-ups appear while
                  Pawfolio is open.
                </small>
              </label>
            </>
          )}
          {(isDog || kind === 'vaccine') && (
            <PhotoPicker
              value={photo}
              onChange={setPhoto}
              onBusy={setPhotoBusy}
              label={
                isDog
                  ? 'Dog portrait (optional)'
                  : 'Vaccination card photo (optional)'
              }
            />
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="dialog-actions">
            <button type="button" className="subtle-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={photoBusy}>
              {pending ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Saving…
                </>
              ) : (
                <>
                  {kind === 'add-dog' ? 'Add dog' : 'Save details'}
                  <Check size={16} />
                </>
              )}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
