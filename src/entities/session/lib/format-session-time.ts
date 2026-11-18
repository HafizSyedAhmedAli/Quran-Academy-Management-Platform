import { APP_TIMEZONE } from '@/shared/config/app';

/** e.g. "Wed, Nov 18, 7:00 PM", always in the academy's timezone, whatever the server's own zone is. */
export function formatSessionStart(startsAt: Date, timeZone: string = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(startsAt);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')}, ${get('month')} ${get('day')}, ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
}
