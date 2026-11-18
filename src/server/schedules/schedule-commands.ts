import { prisma } from '@/server/db/prisma';
import type { Actor } from '@/server/domain/access-policy';
import { NotFoundError, ValidationError } from '@/server/domain/errors';
import { addDays, fromDbDate, isoWeekday, toDbDate } from '@/server/domain/local-date';
import {
  exceptionCreateSchema,
  scheduleChangeSchema,
  scheduleCreateSchema,
  scheduleEndSchema,
} from '@/server/domain/schedule-schemas';
import { parseId, requireTeacher } from '@/server/students/shared';
import { generateUpcomingSessions } from './generate';
import {
  assertNoOverlap,
  auditData,
  toExceptionView,
  toScheduleView,
  todayOf,
  type Clock,
  type ExceptionView,
  type ScheduleView,
} from './shared';

export async function createSchedules(
  actor: Actor,
  input: unknown,
  clock: Clock = {},
): Promise<ScheduleView[]> {
  requireTeacher(actor);
  const data = scheduleCreateSchema.parse(input);
  if (data.effectiveFrom < todayOf(clock)) {
    throw new ValidationError('Start date cannot be in the past');
  }

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: data.studentId },
      select: { id: true },
    });
    if (!student) throw new NotFoundError();

    const created: ScheduleView[] = [];
    for (const weekday of data.weekdays) {
      await assertNoOverlap(tx, {
        studentId: data.studentId,
        weekday,
        startMinute: data.startMinute,
        from: data.effectiveFrom,
        to: data.effectiveTo,
      });
      const row = await tx.classSchedule.create({
        data: {
          studentId: data.studentId,
          weekday,
          startMinute: data.startMinute,
          durationMinutes: data.durationMinutes,
          effectiveFrom: toDbDate(data.effectiveFrom),
          effectiveTo: data.effectiveTo ? toDbDate(data.effectiveTo) : null,
        },
      });
      await tx.auditEvent.create({ data: auditData(actor, 'schedule.created', row.id) });
      created.push(toScheduleView(row));
    }
    await generateUpcomingSessions(tx, clock.now ?? new Date());
    return created;
  });
}

/**
 * "Change from date D": the old schedule ends on D-1 and a new schedule starts on D.
 * Sessions before D are never touched. Only future SCHEDULED sessions on/after D are replaced.
 */
export async function changeSchedule(
  actor: Actor,
  scheduleId: string,
  input: unknown,
  clock: Clock = {},
): Promise<ScheduleView> {
  requireTeacher(actor);
  const id = parseId(scheduleId);
  const data = scheduleChangeSchema.parse(input);
  const today = todayOf(clock);

  return prisma.$transaction(async (tx) => {
    const old = await tx.classSchedule.findUnique({ where: { id } });
    if (!old) throw new NotFoundError();
    const oldFrom = fromDbDate(old.effectiveFrom);
    const oldTo = old.effectiveTo ? fromDbDate(old.effectiveTo) : null;

    if (data.effectiveFrom < today) throw new ValidationError('A change cannot start in the past');
    if (data.effectiveFrom <= oldFrom) {
      throw new ValidationError('A change must start after the current schedule begins');
    }
    if (oldTo !== null && data.effectiveFrom > oldTo) {
      throw new ValidationError('This schedule has already ended before that date');
    }

    await tx.classSession.deleteMany({
      where: {
        scheduleId: id,
        status: 'SCHEDULED',
        localDate: { gte: toDbDate(data.effectiveFrom) },
      },
    });
    await tx.classSchedule.update({
      where: { id },
      data: { effectiveTo: toDbDate(addDays(data.effectiveFrom, -1)) },
    });
    await assertNoOverlap(tx, {
      studentId: old.studentId,
      weekday: data.weekday,
      startMinute: data.startMinute,
      from: data.effectiveFrom,
      to: oldTo,
    });
    const created = await tx.classSchedule.create({
      data: {
        studentId: old.studentId,
        weekday: data.weekday,
        startMinute: data.startMinute,
        durationMinutes: data.durationMinutes,
        effectiveFrom: toDbDate(data.effectiveFrom),
        effectiveTo: old.effectiveTo,
      },
    });
    await tx.auditEvent.create({ data: auditData(actor, 'schedule.changed', created.id) });
    await generateUpcomingSessions(tx, clock.now ?? new Date());
    return toScheduleView(created);
  });
}

export async function endSchedule(
  actor: Actor,
  scheduleId: string,
  input: unknown,
  clock: Clock = {},
): Promise<ScheduleView> {
  requireTeacher(actor);
  const id = parseId(scheduleId);
  const { lastDate } = scheduleEndSchema.parse(input);
  const yesterday = addDays(todayOf(clock), -1);

  return prisma.$transaction(async (tx) => {
    const schedule = await tx.classSchedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundError();
    const from = fromDbDate(schedule.effectiveFrom);
    const to = schedule.effectiveTo ? fromDbDate(schedule.effectiveTo) : null;

    if (lastDate < yesterday) throw new ValidationError('A schedule cannot be ended retroactively');
    if (lastDate < from) {
      throw new ValidationError('The last class date cannot be before the schedule starts');
    }
    if (to !== null && lastDate >= to) {
      throw new ValidationError('The schedule already ends on or before that date');
    }

    await tx.classSession.deleteMany({
      where: { scheduleId: id, status: 'SCHEDULED', localDate: { gt: toDbDate(lastDate) } },
    });
    const updated = await tx.classSchedule.update({
      where: { id },
      data: { effectiveTo: toDbDate(lastDate) },
    });
    await tx.auditEvent.create({ data: auditData(actor, 'schedule.ended', id) });
    return toScheduleView(updated);
  });
}

export async function addScheduleException(
  actor: Actor,
  scheduleId: string,
  input: unknown,
  clock: Clock = {},
): Promise<ExceptionView> {
  requireTeacher(actor);
  const id = parseId(scheduleId);
  const data = exceptionCreateSchema.parse(input);
  const today = todayOf(clock);

  return prisma.$transaction(async (tx) => {
    const schedule = await tx.classSchedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundError();
    const from = fromDbDate(schedule.effectiveFrom);
    const to = schedule.effectiveTo ? fromDbDate(schedule.effectiveTo) : null;

    if (data.localDate < today) throw new ValidationError('You cannot skip a date in the past');
    if (data.localDate < from || (to !== null && data.localDate > to)) {
      throw new ValidationError('That date is outside this schedule’s period');
    }
    if (isoWeekday(data.localDate) !== schedule.weekday) {
      throw new ValidationError('That date does not fall on this schedule’s weekday');
    }

    const existing = await tx.classScheduleException.findUnique({
      where: { scheduleId_localDate: { scheduleId: id, localDate: toDbDate(data.localDate) } },
    });
    if (existing) return toExceptionView(existing);

    const created = await tx.classScheduleException.create({
      data: { scheduleId: id, localDate: toDbDate(data.localDate), reason: data.reason },
    });
    await tx.classSession.deleteMany({
      where: { scheduleId: id, status: 'SCHEDULED', localDate: toDbDate(data.localDate) },
    });
    await tx.auditEvent.create({ data: auditData(actor, 'schedule.exception_added', id) });
    return toExceptionView(created);
  });
}

export async function removeScheduleException(
  actor: Actor,
  exceptionId: string,
  clock: Clock = {},
): Promise<void> {
  requireTeacher(actor);
  const id = parseId(exceptionId);
  const today = todayOf(clock);

  await prisma.$transaction(async (tx) => {
    const exception = await tx.classScheduleException.findUnique({ where: { id } });
    if (!exception) throw new NotFoundError();
    if (fromDbDate(exception.localDate) < today) {
      throw new ValidationError('You cannot change a skipped date in the past');
    }
    await tx.classScheduleException.delete({ where: { id } });
    await tx.auditEvent.create({
      data: auditData(actor, 'schedule.exception_removed', exception.scheduleId),
    });
    await generateUpcomingSessions(tx, clock.now ?? new Date());
  });
}

export async function ensureUpcomingSessions(
  actor: Actor,
  clock: Clock = {},
): Promise<{ created: number }> {
  requireTeacher(actor);
  return generateUpcomingSessions(prisma, clock.now ?? new Date());
}
