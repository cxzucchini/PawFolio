import React, { useEffect, useState } from 'react';
import { CalendarDays, Scissors } from 'lucide-react';

const statuses = ['All', 'Overdue', 'Upcoming', 'Completed'];
const types = ['All types', 'Vet visit', 'Grooming', 'Medication', 'Other'];

export default function ScheduleBoard({
  reminders,
  renderList,
  onAddGrooming,
}) {
  const [status, setStatus] = useState('All');
  const [type, setType] = useState('All types');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  function state(item) {
    return item.completed
      ? 'Completed'
      : new Date(item.scheduledAt).getTime() < now
        ? 'Overdue'
        : 'Upcoming';
  }
  const matching = reminders.filter(
    (item) =>
      (type === 'All types' || item.type === type) &&
      `${item.title} ${item.type}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const groups = statuses.slice(1).map((label) => ({
    label,
    items: matching
      .filter((item) => state(item) === label)
      .sort((a, b) =>
        label === 'Completed'
          ? new Date(b.scheduledAt) - new Date(a.scheduledAt)
          : new Date(a.scheduledAt) - new Date(b.scheduledAt),
      ),
  }));
  const visible = groups.filter(
    (group) => status === 'All' || status === group.label,
  );
  const count = visible.reduce((total, group) => total + group.items.length, 0);
  function clearFilters() {
    setStatus('All');
    setType('All types');
    setSearch('');
  }
  return (
    <section className="dash-panel schedule-board">
      <div className="schedule-board-heading">
        <h2>
          <CalendarDays size={20} /> Schedule
        </h2>
        <button className="subtle-button" onClick={onAddGrooming}>
          <Scissors size={16} /> Add grooming
        </button>
      </div>
      <div className="schedule-tools">
        <label>
          Search schedules
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title or appointment type"
          />
        </label>
        <label>
          Appointment type
          <select
            aria-label="Appointment type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {types.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="filter-tabs schedule-status-filters"
        aria-label="Schedule status"
      >
        {statuses.map((value) => (
          <button
            key={value}
            className={status === value ? 'active' : ''}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value}{' '}
            <span>
              {value === 'All'
                ? matching.length
                : groups.find((group) => group.label === value).items.length}
            </span>
          </button>
        ))}
      </div>
      {count ? (
        visible
          .filter((group) => group.items.length)
          .map((group) => (
            <section
              className="schedule-group"
              key={group.label}
              aria-label={`${group.label} schedules`}
            >
              <h3>
                {group.label} <span>{group.items.length}</span>
              </h3>
              {renderList(group.items)}
            </section>
          ))
      ) : (
        <div className="empty-records">
          <CalendarDays size={25} />
          <strong>
            {reminders.length
              ? 'No matching schedules.'
              : 'Nothing scheduled yet.'}
          </strong>
          <p>
            {reminders.length
              ? 'Try another status, appointment type, or search.'
              : 'Add a vet visit, grooming appointment, medication, or another reminder.'}
          </p>
          {reminders.length > 0 && (
            <button className="subtle-button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </section>
  );
}
