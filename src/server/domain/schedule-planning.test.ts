import { describe, it, expect } from 'vitest';
import { addDays } from './local-date';
import { planSessions, SESSION_HORIZON_DAYS, type PlanSchedule } from './schedule-planning';

const sched = (o: Partial<PlanSchedule> = {}): PlanSchedule => ({
  id: 's1',
  studentId: 'st1',
  weekday: 1,
  startMinute: 19 * 60,
  durationMinutes: 60,
  timezone: 'Asia/Karachi',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  ...o,
});

const dates = (r: { localDate: string }[]) => r.map((x) => x.localDate);

describe('planSessions', () => {
  it('plans one session per matching weekday at the right UTC time', () => {
    const plan = planSessions({
      schedules: [
        sched({ id: 'a', weekday: 1 }),
        sched({ id: 'b', weekday: 3 }),
        sched({ id: 'c', weekday: 5 }),
      ],
      exceptions: [],
      from: '2026-11-16',
      to: '2026-11-22',
    });
    expect(dates(plan)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20']);
    expect(plan[0].startsAt.toISOString()).toBe('2026-11-16T14:00:00.000Z');
    expect(plan[0].endsAt.toISOString()).toBe('2026-11-16T15:00:00.000Z');
  });

  it('starts at the window start, not before', () => {
    const plan = planSessions({
      schedules: [sched()],
      exceptions: [],
      from: '2026-11-18',
      to: '2026-11-30',
    });
    expect(dates(plan)).toEqual(['2026-11-23', '2026-11-30']);
  });

  it('respects effectiveFrom and effectiveTo (inclusive)', () => {
    const plan = planSessions({
      schedules: [sched({ effectiveFrom: '2026-11-23', effectiveTo: '2026-12-07' })],
      exceptions: [],
      from: '2026-11-16',
      to: '2026-12-31',
    });
    expect(dates(plan)).toEqual(['2026-11-23', '2026-11-30', '2026-12-07']);
  });

  it('skips exception dates for that schedule only', () => {
    const plan = planSessions({
      schedules: [sched({ id: 'a' }), sched({ id: 'b' })],
      exceptions: [{ scheduleId: 'a', localDate: '2026-11-23' }],
      from: '2026-11-23',
      to: '2026-11-23',
    });
    expect(plan.map((p) => p.scheduleId)).toEqual(['b']);
  });

  it('produces at most 12 sessions for Mon/Wed/Fri in the default 28-day window', () => {
    const from = '2026-11-18';
    const plan = planSessions({
      schedules: [
        sched({ id: 'a', weekday: 1 }),
        sched({ id: 'b', weekday: 3 }),
        sched({ id: 'c', weekday: 5 }),
      ],
      exceptions: [],
      from,
      to: addDays(from, SESSION_HORIZON_DAYS - 1),
    });
    expect(plan).toHaveLength(12);
  });

  it('is sorted by start time', () => {
    const plan = planSessions({
      schedules: [
        sched({ id: 'late', startMinute: 20 * 60 }),
        sched({ id: 'early', startMinute: 8 * 60 }),
      ],
      exceptions: [],
      from: '2026-11-23',
      to: '2026-11-23',
    });
    expect(plan.map((p) => p.scheduleId)).toEqual(['early', 'late']);
  });

  it('refuses an unbounded window', () => {
    expect(() =>
      planSessions({ schedules: [sched()], exceptions: [], from: '2026-01-01', to: '2027-01-01' }),
    ).toThrow(RangeError);
  });
});
