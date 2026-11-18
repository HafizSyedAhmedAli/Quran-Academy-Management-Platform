export type LocalDate = string; // 'YYYY-MM-DD', a calendar date with no time zone

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(s: string): { y: number; m: number; d: number } {
  const match = LOCAL_DATE.exec(s);
  if (!match) throw new RangeError(`Invalid local date: ${s}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function isValidLocalDate(s: string): boolean {
  const match = LOCAL_DATE.exec(s);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(s: LocalDate, n: number): LocalDate {
  const { y, m, d } = parse(s);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  const pa = parse(a);
  const pb = parse(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** ISO weekday: Monday = 1 ... Sunday = 7 */
export function isoWeekday(s: LocalDate): number {
  const { y, m, d } = parse(s);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

// Prisma `@db.Date` columns come back as UTC-midnight Date objects.
export const toDbDate = (s: LocalDate): Date => new Date(`${s}T00:00:00.000Z`);
export const fromDbDate = (d: Date): LocalDate => d.toISOString().slice(0, 10);

export function parseTimeOfDay(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new RangeError(`Invalid time of day: ${hhmm}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinutes(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(instant: Date, timeZone: string) {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, fmt);
  }
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(instant)) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    mi: Number(p.minute),
    s: Number(p.second),
  };
}

function offsetMs(instant: Date, timeZone: string): number {
  const z = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi, z.s);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The calendar date it is, in `timeZone`, at `instant`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const z = zonedParts(instant, timeZone);
  return `${String(z.y).padStart(4, '0')}-${String(z.m).padStart(2, '0')}-${String(z.d).padStart(2, '0')}`;
}

/** The UTC instant at which the wall clock in `timeZone` reads `minutes` after midnight on `date`. */
export function zonedTimeToUtc(date: LocalDate, minutes: number, timeZone: string): Date {
  const { y, m, d } = parse(date);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = naive - offsetMs(new Date(naive), timeZone);
  guess = naive - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}
