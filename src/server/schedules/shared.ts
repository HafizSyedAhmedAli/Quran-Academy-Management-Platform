import type { DbClient } from '@/server/db/client-type';
import type { Actor } from '@/server/domain/access-policy';
import { ConflictError } from '@/server/domain/errors';
import {
  formatMinutes,
  fromDbDate,
  localDateOf,
  toDbDate,
  type LocalDate,
} from '@/server/domain/local-date';
import { APP_TIMEZONE } from '@/shared/config/app';

export type Clock = { now?: Date };

export const todayOf = (clock: Clock): LocalDate =>
  localDateOf(clock.now ?? new Date(), APP_TIMEZONE);

export type ScheduleView = {
  id: string;
  studentId: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  effectiveFrom: LocalDate;
  effectiveTo: LocalDate | null;
};

export type ExceptionView = {
  id: string;
  scheduleId: string;
  localDate: LocalDate;
  reason: string | null;
};

type ScheduleRow = {
  id: string;
  studentId: string;
  weekday: number;
  startMinute: number;
  durationMinutes: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export const toScheduleView = (r: ScheduleRow): ScheduleView => ({
  id: r.id,
  studentId: r.studentId,
  weekday: r.weekday,
  startTime: formatMinutes(r.startMinute),
  durationMinutes: r.durationMinutes,
  effectiveFrom: fromDbDate(r.effectiveFrom),
  effectiveTo: r.effectiveTo ? fromDbDate(r.effectiveTo) : null,
});

export const toExceptionView = (r: {
  id: string;
  scheduleId: string;
  localDate: Date;
  reason: string | null;
}): ExceptionView => ({
  id: r.id,
  scheduleId: r.scheduleId,
  localDate: fromDbDate(r.localDate),
  reason: r.reason,
});

export const auditData = (actor: Actor, action: string, entityId: string) => ({
  actorId: actor.userId,
  action,
  entity: 'ClassSchedule',
  entityId,
});

// Friendly pre-check. The database exclusion constraint is the real guarantee.
export async function assertNoOverlap(
  db: DbClient,
  slot: {
    studentId: string;
    weekday: number;
    startMinute: number;
    from: LocalDate;
    to: LocalDate | null;
  },
): Promise<void> {
  const clash = await db.classSchedule.findFirst({
    where: {
      studentId: slot.studentId,
      weekday: slot.weekday,
      startMinute: slot.startMinute,
      effectiveFrom: slot.to ? { lte: toDbDate(slot.to) } : undefined,
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: toDbDate(slot.from) } }],
    },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictError('This student already has a class at that day and time in that period');
  }
}
