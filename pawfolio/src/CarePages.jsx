import React, { useEffect, useRef, useState } from 'react';
import {
  ClipboardPlus,
  ShieldPlus,
  Plus,
  CalendarDays,
  Phone,
  Heart,
  MapPin,
  Pencil,
  Check,
  LoaderCircle,
  X,
  FileText,
} from 'lucide-react';
import { api, localDay } from './api.js';
import PhotoPicker, { RecordPhoto } from './PhotoPicker.jsx';
import DateInput from './DateInput.jsx';
import useLiveRefresh from './useLiveRefresh.js';
import useFormUrl from './useFormUrl.js';
import { designPreviewEnabled } from './designPreview.js';

const categories = [
  'All',
  'Checkup',
  'Treatment',
  'Surgery',
  'Lab result',
  'Other',
];
const emergencyFields = [
  ['contactName', 'Emergency contact name', 100],
  ['contactPhone', 'Contact phone', 40],
  ['clinic', 'Emergency clinic name', 100],
  ['clinicPhone', 'Clinic phone', 40],
  ['clinicAddress', 'Clinic address', 300],
  ['allergies', 'Known allergies', 1000],
  ['medications', 'Current medications', 1000],
  ['conditions', 'Medical conditions', 1000],
  ['instructions', 'Care instructions', 2000],
];
function dateLabel(value) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}
function Heading({ eyebrow, title, text, action, onAction, icon: Icon }) {
  return (
    <section className="dashboard-welcome care-welcome">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <button className="button compact" onClick={onAction}>
        <Icon size={16} />
        {action}
      </button>
    </section>
  );
}

export default function CarePages({ kind, dog, onExpired }) {
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useFormUrl(false, kind);
  const [editRecord, setEditRecord] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const medical = kind === 'medical';
  useEffect(() => {
    if (
      !loading &&
      designPreviewEnabled() &&
      new URLSearchParams(window.location.search).get('form') === kind
    )
      setEditing(true);
  }, [loading, kind]);
  const careLive = useLiveRefresh(
    async (signal) => {
      try {
        const result = await api(`/dogs/${dog._id}/${kind}`, { signal });
        if (!signal.aborted) {
          setRecords(result.records || []);
          setProfile(result.profile || null);
        }
      } catch (failure) {
        if (failure.status === 401) onExpired();
        throw failure;
      }
    },
    { enabled: !loading, paused: editing || deleting },
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api(`/dogs/${dog._id}/${kind}`)
      .then((result) => {
        if (active) {
          setRecords(result.records || []);
          setProfile(result.profile || null);
        }
      })
      .catch((failure) => {
        if (active) {
          if (failure.status === 401) onExpired();
          else setError(failure.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dog._id, kind]);
  async function save(values) {
    const result = await api(
      `/dogs/${dog._id}/${kind}${medical && editRecord ? '/' + editRecord._id : ''}`,
      {
        method: medical && !editRecord ? 'POST' : 'PUT',
        body: values,
      },
    );
    if (medical)
      setRecords((current) =>
        [
          result.record,
          ...current.filter((item) => item._id !== result.record._id),
        ].sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)),
      );
    else setProfile(result.profile);
    setEditing(false);
    setEditRecord(null);
    setNotice(medical ? 'Medical record saved.' : 'Emergency details saved.');
  }
  const visible = records.filter(
    (record) =>
      (filter === 'All' || record.category === filter) &&
      `${record.title} ${record.clinic || ''} ${record.veterinarian || ''} ${record.notes || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function removeRecord(record) {
    if (
      deleting ||
      !window.confirm(
        `Delete “${record.title}” from medical history? This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    setError('');
    try {
      await api(`/dogs/${dog._id}/medical/${record._id}`, { method: 'DELETE' });
      setRecords((current) =>
        current.filter((item) => item._id !== record._id),
      );
      setNotice('Medical record deleted.');
    } catch (failure) {
      if (failure.status === 401) onExpired();
      else setError(failure.message);
    } finally {
      setDeleting(false);
    }
  }
  const latest = records[0];
  return (
    <div className="care-page">
      {['error', 'offline'].includes(careLive.phase) && (
        <div className="live-update-warning" role="status">
          <span>
            {careLive.phase === 'offline'
              ? 'You are offline. Showing the last loaded care details.'
              : 'Care details could not refresh. Your saved details are still visible.'}
          </span>
          {careLive.phase === 'error' && (
            <button className="subtle-button" onClick={careLive.refreshNow}>
              Retry refresh
            </button>
          )}
        </div>
      )}
      <Heading
        eyebrow={
          medical
            ? 'THEIR HEALTH STORY, TOGETHER'
            : 'IMPORTANT DETAILS, CLOSE AT HAND'
        }
        title={`${dog.name}’s ${medical ? 'medical history' : 'emergency vault'}`}
        text={
          medical
            ? 'Keep vet visits, treatments, and care notes in one familiar place.'
            : 'Prepare the contacts and care details someone might need in a hurry.'
        }
        action={
          medical ? 'Add record' : profile ? 'Edit details' : 'Add details'
        }
        onAction={() => {
          setEditRecord(null);
          setEditing(true);
        }}
        icon={medical ? Plus : Pencil}
      />
      {notice && (
        <div className="dashboard-notice" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="dashboard-loading" role="status">
          <LoaderCircle className="spin" /> Loading care details…
        </div>
      ) : (
        !error &&
        (medical ? (
          <>
            <div className="care-summary-grid">
              <Summary
                icon={ClipboardPlus}
                label="Saved records"
                value={records.length}
              />
              <Summary
                icon={CalendarDays}
                label="Last recorded visit"
                value={latest ? dateLabel(latest.visitedAt) : 'Not recorded'}
              />
              <Summary
                icon={Heart}
                label="Primary veterinarian"
                value={dog.veterinarian || 'Not added'}
              />
            </div>
            <section className="dash-panel">
              <div className="care-panel-heading">
                <h2>
                  <FileText size={19} /> Care timeline
                </h2>
                <label className="care-search">
                  Search records
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Title, clinic, or notes"
                  />
                </label>
              </div>
              <div
                className="filter-tabs care-filters"
                aria-label="Record categories"
              >
                {categories.map((category) => (
                  <button
                    key={category}
                    aria-pressed={filter === category}
                    className={filter === category ? 'active' : ''}
                    onClick={() => setFilter(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              {visible.length ? (
                <div className="medical-timeline">
                  {visible.map((record) => (
                    <article className="medical-entry" key={record._id}>
                      <span className="medical-dot">
                        <ClipboardPlus size={18} />
                      </span>
                      <div className="medical-entry-content">
                        <div className="medical-entry-top">
                          <time dateTime={record.visitedAt}>
                            {dateLabel(record.visitedAt)}
                          </time>
                          <span className="care-category">
                            {record.category}
                          </span>
                          <div className="medical-entry-actions">
                            <button
                              className="subtle-button"
                              disabled={deleting}
                              onClick={() => {
                                setEditRecord(record);
                                setEditing(true);
                              }}
                              aria-label={`Edit medical record: ${record.title}`}
                            >
                              Edit
                            </button>
                            <button
                              className="record-delete"
                              disabled={deleting}
                              onClick={() => removeRecord(record)}
                              aria-label={`Delete medical record: ${record.title}`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <h3>{record.title}</h3>
                        <p className="medical-provider">
                          {[record.veterinarian, record.clinic]
                            .filter(Boolean)
                            .join(' · ') || 'Provider not recorded'}
                        </p>
                        <RecordPhoto
                          photo={record.photo}
                          title={record.title}
                        />
                        {record.notes && (
                          <details>
                            <summary>View care notes</summary>
                            <p className="care-notes">{record.notes}</p>
                          </details>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={ClipboardPlus}
                  title={
                    records.length
                      ? 'No matching records'
                      : 'Their health story starts here'
                  }
                  text={
                    records.length
                      ? 'Try another search or category.'
                      : 'Add a past visit or treatment, including notes from your veterinarian.'
                  }
                />
              )}
            </section>
          </>
        ) : (
          <>
            <div className="vault-banner">
              <ShieldPlus size={25} />
              <div>
                <strong>A little preparation brings peace of mind.</strong>
                <p>
                  Keep these details up to date. If your dog needs urgent care,
                  contact your veterinarian or emergency clinic.
                </p>
              </div>
            </div>
            <div className="vault-grid">
              <section className="dash-panel">
                <h2 className="care-card-title">
                  <Phone size={19} /> Emergency contacts
                </h2>
                <Contact
                  title="Trusted person"
                  name={profile?.contactName}
                  phone={profile?.contactPhone}
                />
                <Contact
                  title="Emergency veterinary clinic"
                  name={profile?.clinic}
                  phone={profile?.clinicPhone}
                  address={profile?.clinicAddress}
                />
              </section>
              <section className="dash-panel">
                <h2 className="care-card-title">
                  <Heart size={19} /> Essential care details
                </h2>
                {[
                  ['Known allergies', profile?.allergies],
                  ['Current medications', profile?.medications],
                  ['Medical conditions', profile?.conditions],
                ].map(([label, value]) => (
                  <div className="vault-detail" key={label}>
                    <span>{label}</span>
                    <p>
                      {value ||
                        'Not recorded — confirm with your veterinarian.'}
                    </p>
                  </div>
                ))}
              </section>
              <section className="dash-panel">
                <h2 className="care-card-title">
                  <ShieldPlus size={19} /> Identification
                </h2>
                <div className="vault-detail">
                  <span>Dog</span>
                  <p>
                    {dog.name} · {dog.breed}
                  </p>
                </div>
                <div className="vault-detail">
                  <span>Microchip</span>
                  <p>{dog.microchip || 'Not added'}</p>
                </div>
                <div className="vault-detail">
                  <span>Primary veterinarian</span>
                  <p>{dog.veterinarian || 'Not added'}</p>
                </div>
              </section>
              <section className="dash-panel">
                <h2 className="care-card-title">
                  <FileText size={19} /> Care instructions
                </h2>
                <p className="care-notes">
                  {profile?.instructions ||
                    'Add handling tips, transport arrangements, or instructions from your veterinarian for a trusted caregiver.'}
                </p>
                {profile?.updatedAt && (
                  <small className="vault-updated">
                    Last updated {dateLabel(profile.updatedAt)}
                  </small>
                )}
              </section>
            </div>
          </>
        ))
      )}
      {!medical && profile && (
        <button
          className="record-delete"
          disabled={deleting}
          onClick={async () => {
            if (
              deleting ||
              !window.confirm(
                'Delete all emergency vault details? This cannot be undone.',
              )
            )
              return;
            setDeleting(true);
            setError('');
            try {
              await api(`/dogs/${dog._id}/emergency`, { method: 'DELETE' });
              setProfile(null);
              setNotice('Emergency details deleted.');
            } catch (failure) {
              if (failure.status === 401) onExpired();
              else setError(failure.message);
            } finally {
              setDeleting(false);
            }
          }}
        >
          Delete emergency details
        </button>
      )}
      {editing && (
        <CareDialog
          record={editRecord}
          medical={medical}
          profile={profile}
          onClose={() => {
            setEditing(false);
            setEditRecord(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}
function Summary({ icon: Icon, label, value }) {
  return (
    <div className="care-summary">
      <span className="icon-box peach">
        <Icon size={21} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function Empty({ icon: Icon, title, text }) {
  return (
    <div className="empty-records">
      <Icon size={28} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
function Contact({ title, name, phone, address }) {
  const dialable = phone && /^\+?[\d\s().-]{3,40}$/.test(phone);
  return (
    <div className="vault-contact">
      <span className="vault-contact-label">{title}</span>
      <strong>{name || 'Not added'}</strong>
      {phone ? <p>{phone}</p> : <p>Phone number not added</p>}
      {address && (
        <p className="vault-address">
          <MapPin size={15} />
          {address}
        </p>
      )}
      {dialable && (
        <a className="vault-call" href={`tel:${phone.replace(/[^+\d]/g, '')}`}>
          <Phone size={15} />
          Call {title === 'Trusted person' ? 'contact' : 'clinic'}
        </a>
      )}
    </div>
  );
}
function CareDialog({ medical, profile, record, onClose, onSave }) {
  const ref = useRef(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState(record?.photo || '');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [step, setStep] = useState(0);
  const steps = [
    'Trusted contact',
    'Emergency clinic',
    'Health details',
    'Care instructions',
  ];
  const ranges = [
    [0, 2],
    [2, 5],
    [5, 8],
    [8, 9],
  ];
  const stepHeading = useRef(null);
  useEffect(() => {
    if (!medical) {
      stepHeading.current?.focus();
      ref.current.scrollTop = 0;
    }
  }, [step, medical]);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (photoBusy) return;
    if (!medical && step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    setPending(true);
    setError('');
    try {
      await onSave({
        ...Object.fromEntries(new FormData(event.currentTarget)),
        ...(medical ? { photo } : {}),
      });
    } catch (failure) {
      setError(failure.message);
      setPending(false);
    }
  }
  return (
    <dialog
      className="record-dialog care-dialog"
      ref={ref}
      aria-labelledby="care-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <button
        className="dialog-close icon-button"
        disabled={pending}
        onClick={onClose}
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <span className="eyebrow">
        {medical ? 'A NEW CHAPTER OF CARE' : 'READY WHEN IT MATTERS'}
      </span>
      <h2 id="care-dialog-title">
        {medical
          ? record
            ? 'Edit medical record'
            : 'Add a medical record'
          : 'Emergency details'}
      </h2>
      <form onSubmit={submit}>
        <fieldset disabled={pending}>
          {medical ? (
            <>
              <label>
                Record title
                <input
                  name="title"
                  required
                  autoFocus
                  maxLength={120}
                  defaultValue={record?.title || ''}
                  placeholder="e.g. Annual wellness check"
                />
              </label>
              <div className="form-grid">
                <label>
                  Category
                  <select
                    name="category"
                    defaultValue={record?.category || 'Checkup'}
                  >
                    {categories.slice(1).map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Visit date
                  <DateInput
                    name="visitedAt"
                    type="date"
                    max={localDay()}
                    defaultValue={record?.visitedAt?.slice(0, 10) || localDay()}
                    required
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Veterinarian
                  <input
                    name="veterinarian"
                    maxLength={100}
                    defaultValue={record?.veterinarian || ''}
                  />
                </label>
                <label>
                  Clinic
                  <input
                    name="clinic"
                    maxLength={100}
                    defaultValue={record?.clinic || ''}
                  />
                </label>
              </div>
              <label>
                Care notes
                <textarea
                  name="notes"
                  defaultValue={record?.notes || ''}
                  rows={4}
                  maxLength={3000}
                  placeholder="Record the visit summary and advice provided by your veterinarian."
                />
              </label>
              <PhotoPicker
                value={photo}
                onChange={setPhoto}
                onBusy={setPhotoBusy}
                label="Medical record photo (optional)"
              />
            </>
          ) : (
            <>
              <nav className="vault-steps" aria-label="Emergency form steps">
                {steps.map((label, index) => (
                  <button
                    type="button"
                    key={label}
                    aria-current={step === index ? 'step' : undefined}
                    onClick={() => setStep(index)}
                  >
                    <span>{index + 1}</span>
                    {label}
                  </button>
                ))}
              </nav>
              <h3
                className="vault-step-heading"
                ref={stepHeading}
                tabIndex={-1}
              >
                {steps[step]}
              </h3>
              <p className="vault-step-note">
                Step {step + 1} of {steps.length}. All fields are optional. Your
                entries stay here as you move between steps.
              </p>
              {ranges.map(([start, end], group) => (
                <div key={group} hidden={step !== group}>
                  {emergencyFields
                    .slice(start, end)
                    .map(([field, label, max], index) => (
                      <label key={field}>
                        {label}
                        {start + index >= 5 ? (
                          <textarea
                            name={field}
                            rows={3}
                            maxLength={max}
                            defaultValue={profile?.[field] || ''}
                          />
                        ) : (
                          <input
                            name={field}
                            type={field.includes('Phone') ? 'tel' : 'text'}
                            maxLength={max}
                            defaultValue={profile?.[field] || ''}
                          />
                        )}
                      </label>
                    ))}
                </div>
              ))}
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="care-form-actions">
            <button type="button" className="subtle-button" onClick={onClose}>
              Cancel
            </button>
            {!medical && step > 0 && (
              <button
                type="button"
                className="subtle-button"
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </button>
            )}
            <button className="button" type="submit" disabled={photoBusy}>
              {pending
                ? 'Saving…'
                : !medical && step < steps.length - 1
                  ? 'Next'
                  : 'Save details'}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
