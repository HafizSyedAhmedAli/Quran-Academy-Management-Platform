import { describe, it, expect, beforeEach } from 'vitest';
import { ZodError } from 'zod';
import { prisma } from '@/server/db/prisma';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/server/domain/errors';
import { toDbDate } from '@/server/domain/local-date';
import { generateUpcomingSessions } from '@/server/schedules/generate';
import {
  addScheduleException,
  changeSchedule,
  createSchedules,
  endSchedule,
  ensureUpcomingSessions,
  removeScheduleException,
} from '@/server/schedules/schedule-commands';
import {
  resetDb,
  createTeacher,
  createParent,
  createStudent,
  createSchedule,
  sessionRow,
  teacherActor,
  parentActor,
} from './helpers';

const NOW = new Date('2026-11-18T08:00:00Z'); // today in Karachi: 2026-11-18 (Wednesday)
const clock = { now: NOW };
const day = (d: Date) => d.toISOString().slice(0, 10);
const input = (studentId: string, extra: Record<string, unknown> = {}) => ({
  studentId,
  weekdays: [1, 3, 5],
  startTime: '19:00',
  durationMinutes: 60,
  effectiveFrom: '2026-11-18',
  ...extra,
});

async function sessionDates(scheduleId?: string) {
  const rows = await prisma.classSession.findMany({
    where: scheduleId ? { scheduleId } : {},
    orderBy: { startsAt: 'asc' },
  });
  return rows.map((r) => day(r.localDate));
}

describe('createSchedules', () => {
  beforeEach(resetDb);

  it('creates one schedule per weekday, generates sessions and audits each schedule', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const views = await createSchedules(teacherActor(t), input(s.id), clock);

    expect(views.map((v) => v.weekday)).toEqual([1, 3, 5]);
    expect(views[0]).toMatchObject({ startTime: '19:00', durationMinutes: 60, effectiveTo: null });
    expect(await prisma.classSession.count()).toBe(12);
    const events = await prisma.auditEvent.findMany();
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.action === 'schedule.created' && e.actorId === t.id)).toBe(true);
  });

  it('forbids a parent and writes nothing', async () => {
    const a = await createParent('a@example.com');
    const s = await createStudent('Ali', [a.parent.id]);
    await expect(
      createSchedules(parentActor(a.user, a.parent), input(s.id), clock),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.classSchedule.count()).toBe(0);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('rejects a start date in the past, an unknown student and invalid input', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const actor = teacherActor(t);
    await expect(
      createSchedules(actor, input(s.id, { effectiveFrom: '2026-11-17' }), clock),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSchedules(actor, input('00000000-0000-4000-8000-000000000000'), clock),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      createSchedules(actor, input(s.id, { startTime: '7pm' }), clock),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await prisma.classSchedule.count()).toBe(0);
  });

  it('rejects an overlapping slot and rolls the whole request back', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const actor = teacherActor(t);
    await createSchedules(actor, input(s.id, { weekdays: [3] }), clock); // Wednesday

    await expect(
      createSchedules(actor, input(s.id, { weekdays: [2, 3] }), clock), // Tuesday ok, Wednesday clashes
    ).rejects.toBeInstanceOf(ConflictError);

    const rows = await prisma.classSchedule.findMany();
    expect(rows.map((r) => r.weekday)).toEqual([3]); // Tuesday was rolled back
  });
});

describe('changeSchedule', () => {
  beforeEach(resetDb);

  it('preserves history: ends the old schedule, replaces only future sessions, never duplicates a date', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const old = await createSchedule(s.id, { weekday: 1, effectiveFrom: '2026-11-02' });
    await prisma.classSession.create({ data: sessionRow(old.id, s.id, '2026-11-09') }); // history
    await generateUpcomingSessions(prisma, NOW); // Nov 23, 30, Dec 7, 14

    const before = await prisma.classSession.findMany({
      where: { localDate: { lt: toDbDate('2026-11-30') } },
      orderBy: { startsAt: 'asc' },
    });
    expect(before.map((r) => day(r.localDate))).toEqual(['2026-11-09', '2026-11-23']);

    const view = await changeSchedule(
      teacherActor(t),
      old.id,
      { weekday: 1, startTime: '20:00', durationMinutes: 45, effectiveFrom: '2026-11-30' },
      clock,
    );

    const oldRow = await prisma.classSchedule.findUniqueOrThrow({ where: { id: old.id } });
    expect(day(oldRow.effectiveTo!)).toBe('2026-11-29');

    const after = await prisma.classSession.findMany({ orderBy: { startsAt: 'asc' } });
    // untouched history
    const untouched = after.filter((r) => day(r.localDate) < '2026-11-30');
    expect(untouched.map((r) => r.id)).toEqual(before.map((r) => r.id));
    expect(untouched.every((r) => r.scheduleId === old.id)).toBe(true);
    // replaced future
    const future = after.filter((r) => day(r.localDate) >= '2026-11-30');
    expect(future.map((r) => day(r.localDate))).toEqual(['2026-11-30', '2026-12-07', '2026-12-14']);
    expect(future.every((r) => r.scheduleId === view.id)).toBe(true);
    expect(future.every((r) => r.startsAt.getUTCHours() === 15)).toBe(true); // 20:00 PKT
    expect(future[0].endsAt.getTime() - future[0].startsAt.getTime()).toBe(45 * 60 * 1000);
    // one session per date
    expect(new Set(after.map((r) => day(r.localDate))).size).toBe(after.length);

    expect(await prisma.auditEvent.count({ where: { action: 'schedule.changed' } })).toBe(1);
  });

  it('rejects a change in the past, a change not after the start date, and an unknown schedule', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const actor = teacherActor(t);
    const sch = await createSchedule(s.id, { weekday: 1, effectiveFrom: '2026-11-23' });
    const change = (effectiveFrom: string) => ({
      weekday: 1,
      startTime: '20:00',
      durationMinutes: 60,
      effectiveFrom,
    });

    await expect(changeSchedule(actor, sch.id, change('2026-11-10'), clock)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(changeSchedule(actor, sch.id, change('2026-11-23'), clock)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      changeSchedule(actor, '00000000-0000-4000-8000-000000000000', change('2026-12-07'), clock),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.classSchedule.count()).toBe(1);
  });

  it('forbids a parent', async () => {
    const a = await createParent('a@example.com');
    const s = await createStudent('Ali', [a.parent.id]);
    const sch = await createSchedule(s.id);
    await expect(
      changeSchedule(
        parentActor(a.user, a.parent),
        sch.id,
        { weekday: 1, startTime: '20:00', durationMinutes: 60, effectiveFrom: '2026-12-07' },
        clock,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('endSchedule', () => {
  beforeEach(resetDb);

  it('removes only future sessions after the last date and stops regeneration', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const sch = await createSchedule(s.id, { weekday: 1, effectiveFrom: '2026-11-02' });
    await prisma.classSession.create({ data: sessionRow(sch.id, s.id, '2026-11-09') });
    await generateUpcomingSessions(prisma, NOW);

    const view = await endSchedule(teacherActor(t), sch.id, { lastDate: '2026-11-30' }, clock);
    expect(view.effectiveTo).toBe('2026-11-30');
    expect(await sessionDates(sch.id)).toEqual(['2026-11-09', '2026-11-23', '2026-11-30']);

    await generateUpcomingSessions(prisma, NOW);
    expect(await sessionDates(sch.id)).toEqual(['2026-11-09', '2026-11-23', '2026-11-30']);
    expect(await prisma.auditEvent.count({ where: { action: 'schedule.ended' } })).toBe(1);
  });

  it('refuses to end retroactively or before the schedule starts', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const sch = await createSchedule(s.id, { weekday: 1, effectiveFrom: '2026-11-02' });
    await generateUpcomingSessions(prisma, NOW);
    const before = await sessionDates();

    await expect(
      endSchedule(teacherActor(t), sch.id, { lastDate: '2026-11-16' }, clock),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      endSchedule(teacherActor(t), sch.id, { lastDate: '2026-11-01' }, clock),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await sessionDates()).toEqual(before);
    expect(
      (await prisma.classSchedule.findUniqueOrThrow({ where: { id: sch.id } })).effectiveTo,
    ).toBeNull();
  });
});

describe('schedule exceptions', () => {
  beforeEach(resetDb);

  async function wednesdaySchedule() {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const sch = await createSchedule(s.id, { weekday: 3, effectiveFrom: '2026-11-16' });
    await generateUpcomingSessions(prisma, NOW); // Nov 18, 25, Dec 2, 9
    return { t, s, sch };
  }

  it('skips a date: removes that session, is not regenerated, and is idempotent', async () => {
    const { t, sch } = await wednesdaySchedule();
    const actor = teacherActor(t);

    const ex = await addScheduleException(
      actor,
      sch.id,
      { localDate: '2026-11-25', reason: 'Eid' },
      clock,
    );
    expect(ex).toMatchObject({ localDate: '2026-11-25', reason: 'Eid' });
    expect(await sessionDates()).toEqual(['2026-11-18', '2026-12-02', '2026-12-09']);

    await generateUpcomingSessions(prisma, NOW);
    expect(await sessionDates()).toEqual(['2026-11-18', '2026-12-02', '2026-12-09']);

    await addScheduleException(actor, sch.id, { localDate: '2026-11-25' }, clock);
    expect(await prisma.classScheduleException.count()).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: 'schedule.exception_added' } })).toBe(
      1,
    );
  });

  it('rejects the wrong weekday, a past date and a date outside the schedule range', async () => {
    const { t, s } = await wednesdaySchedule();
    const bounded = await createSchedule(s.id, {
      weekday: 5,
      effectiveFrom: '2026-11-20',
      effectiveTo: '2026-12-04',
    });
    const wed = await prisma.classSchedule.findFirstOrThrow({ where: { weekday: 3 } });
    const actor = teacherActor(t);

    await expect(
      addScheduleException(actor, wed.id, { localDate: '2026-11-26' }, clock),
    ).rejects.toBeInstanceOf(ValidationError); // Thursday
    await expect(
      addScheduleException(actor, wed.id, { localDate: '2026-11-11' }, clock),
    ).rejects.toBeInstanceOf(ValidationError); // past Wednesday
    await expect(
      addScheduleException(actor, bounded.id, { localDate: '2026-12-11' }, clock),
    ).rejects.toBeInstanceOf(ValidationError); // after effectiveTo
    expect(await prisma.classScheduleException.count()).toBe(0);
  });

  it('removing an exception brings the session back', async () => {
    const { t, sch } = await wednesdaySchedule();
    const actor = teacherActor(t);
    const ex = await addScheduleException(actor, sch.id, { localDate: '2026-11-25' }, clock);
    await removeScheduleException(actor, ex.id, clock);
    expect(await sessionDates()).toEqual(['2026-11-18', '2026-11-25', '2026-12-02', '2026-12-09']);
    expect(await prisma.classScheduleException.count()).toBe(0);
  });

  it('forbids a parent', async () => {
    const { sch } = await wednesdaySchedule();
    const a = await createParent('a@example.com');
    await expect(
      addScheduleException(
        parentActor(a.user, a.parent),
        sch.id,
        { localDate: '2026-11-25' },
        clock,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('ensureUpcomingSessions', () => {
  beforeEach(resetDb);

  it('generates for the teacher and is forbidden for parents', async () => {
    const t = await createTeacher();
    const a = await createParent('a@example.com');
    const s = await createStudent('Ali', [a.parent.id]);
    await createSchedule(s.id, { weekday: 3, effectiveFrom: '2026-11-16' });

    await expect(
      ensureUpcomingSessions(parentActor(a.user, a.parent), clock),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await ensureUpcomingSessions(teacherActor(t), clock)).created).toBe(4);
  });
});
