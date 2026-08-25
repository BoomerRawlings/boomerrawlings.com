const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatFullDate = (date: Date) => fullDateFormatter.format(date);

export const formatMonthYear = (date: Date) => monthFormatter.format(date);

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export const isoMonth = (date: Date) => date.toISOString().slice(0, 7);

export function formatPartialDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!month) return String(year);

  const date = new Date(Date.UTC(year, month - 1, day ?? 1));
  return day ? fullDateFormatter.format(date) : monthFormatter.format(date);
}
