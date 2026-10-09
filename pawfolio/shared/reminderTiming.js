export const advanceOptions = [
  [0, 'Only when due'],
  [15, '15 minutes before'],
  [30, '30 minutes before'],
  [60, '1 hour before'],
  [1440, '1 day before'],
  [2880, '2 days before'],
];
export function defaultAdvance(type) {
  return type === 'Medication'
    ? 30
    : ['Vet visit', 'Grooming'].includes(type)
      ? 1440
      : 0;
}
export function advanceMinutes(reminder) {
  return reminder.remindBeforeMinutes ?? defaultAdvance(reminder.type);
}
export function advanceLabel(minutes) {
  return (
    advanceOptions.find(([value]) => value === minutes)?.[1] || 'Only when due'
  );
}
