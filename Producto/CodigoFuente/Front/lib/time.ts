export const CHILE_TIME_ZONE = 'America/Santiago';

const chileDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHILE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayChileISO(): string {
  return chileDateFormatter.format(new Date());
}

export function monthAgoChileISO(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return chileDateFormatter.format(date);
}

export function formatChileDate(value?: string | Date | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('es-CL', {
    timeZone: CHILE_TIME_ZONE,
  });
}

export function formatChileDateTime(value?: string | Date | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('es-CL', {
    timeZone: CHILE_TIME_ZONE,
  });
}
