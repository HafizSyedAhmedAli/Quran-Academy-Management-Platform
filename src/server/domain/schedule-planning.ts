import { addDays, daysBetween, isoWeekday, zonedTimeToUtc, type LocalDate } from './local-date';

export const SESSION_HORIZON_DAYS = 28;
const MAX_WINDOW_DAYS = 92;

export type PlanSchedule = {
  id: string;
  studentId: string;
  weekday: number;
  startMinute: number;
  durationMinutes: number;
  timezone: string;
  effectiveFrom: LocalDate;
  effectiveTo: LocalDate | null;
};

export type PlanException = { scheduleId: string; localDate: LocalDate };

export type PlannedSession = {
  scheduleId: string;
  studentId: string;
  localDate: LocalDate;
  startsAt: Date;
  endsAt: Date;
};

/** Pure: which sessions should exist for these schedules between `from` and `to` (inclusive)? */
export function planSessions(input: {
  schedules: readonly PlanSchedule[];
  exceptions: readonly PlanException[];
  from: LocalDate;
  to: LocalDate;
}): PlannedSession[] {
  const { schedules, exceptions, from, to } = input;
  if (daysBetween(from, to) + 1 > MAX_WINDOW_DAYS) {
    throw new RangeError(`Planning window exceeds ${MAX_WINDOW_DAYS} days`);
  }
  const skipped = new Set(exceptions.map((e) => `${e.scheduleId}|${e.localDate}`));
  const planned: PlannedSession[] = [];

  for (const s of schedules) {
    const start = s.effectiveFrom > from ? s.effectiveFrom : from;
    const end = s.effectiveTo !== null && s.effectiveTo < to ? s.effectiveTo : to;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (isoWeekday(d) !== s.weekday || skipped.has(`${s.id}|${d}`)) continue;
      const startsAt = zonedTimeToUtc(d, s.startMinute, s.timezone);
      planned.push({
        scheduleId: s.id,
        studentId: s.studentId,
        localDate: d,
        startsAt,
        endsAt: new Date(startsAt.getTime() + s.durationMinutes * 60_000),
      });
    }
  }

  return planned.sort(
    (a, b) =>
      a.startsAt.getTime() - b.startsAt.getTime() || a.scheduleId.localeCompare(b.scheduleId),
  );
}
