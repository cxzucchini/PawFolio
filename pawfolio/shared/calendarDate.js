export function calendarDay(now = new Date(), timeZone = 'UTC') {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  } catch {
    return calendarDay(now, 'UTC');
  }
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function futureDate(value, timeZone, now = new Date()) {
  return value > calendarDay(now, timeZone);
}
