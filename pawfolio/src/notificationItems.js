import { localDay } from './api.js';
import { advanceMinutes, advanceLabel } from '../shared/reminderTiming.js';

export function notificationItems(vaccinations, reminders, now = Date.now()) {
  const today = localDay(new Date(now));
  const cutoff = now + 7 * 86400000;
  const finalDay = localDay(new Date(cutoff));
  const items = [];
  for (const item of vaccinations) {
    const day = item.nextDueDate?.slice(0, 10);
    if (!day || day > finalDay) continue;
    const group =
      day < today ? 'Overdue' : day === today ? 'Today' : 'Upcoming';
    items.push({
      key: `vaccine-${item._id}-${item.nextDueDate}-${group}`,
      title: item.name,
      date: item.nextDueDate,
      group,
      status: `${group === 'Today' ? 'Due today' : group} · Vaccination`,
      route: '/dashboard/vaccinations',
      timed: false,
    });
  }
  for (const item of reminders) {
    const due = new Date(item.scheduledAt).getTime();
    if (item.completed || !Number.isFinite(due) || due > cutoff) continue;
    const group =
      due < now
        ? 'Overdue'
        : localDay(new Date(due)) === today
          ? 'Today'
          : 'Upcoming';
    items.push({
      key: `reminder-${item._id}-${item.scheduledAt}-${group}`,
      title: item.title,
      date: item.scheduledAt,
      group,
      status: `${group === 'Today' ? 'Due today' : group} · ${item.type}`,
      route: '/dashboard/schedules',
      timed: true,
    });
  }
  const priority = { Overdue: 0, Today: 1, Upcoming: 2 };
  return items.sort(
    (a, b) =>
      priority[a.group] - priority[b.group] ||
      new Date(a.date) - new Date(b.date),
  );
}

export function popupNotificationItems(
  vaccinations,
  reminders,
  now = Date.now(),
) {
  const due = notificationItems(vaccinations, reminders, now).filter((item) =>
    item.timed
      ? new Date(item.date).getTime() <= now
      : item.group !== 'Upcoming',
  );
  const early = reminders
    .filter((item) => {
      const scheduled = new Date(item.scheduledAt).getTime();
      const lead = advanceMinutes(item);
      return (
        !item.completed &&
        lead > 0 &&
        now >= scheduled - lead * 60000 &&
        now < scheduled
      );
    })
    .map((item) => ({
      key: `reminder-${item._id}-${item.scheduledAt}-advance-${advanceMinutes(item)}`,
      title: item.title,
      date: item.scheduledAt,
      group: 'Advance',
      status: `Upcoming · ${item.type} · ${advanceLabel(advanceMinutes(item))}`,
      route: '/dashboard/schedules',
      timed: true,
    }));
  return [...due, ...early.sort((a, b) => new Date(a.date) - new Date(b.date))];
}
