import { prisma } from '@/server/db/prisma';
import type { Actor } from '@/server/domain/access-policy';
import {
  addDays,
  fromDbDate,
  localDateOf,
  toDbDate,
  type LocalDate,
} from '@/server/domain/local-date';
import { SESSION_HORIZON_DAYS } from '@/server/domain/schedule-planning';
import { parseId, requireTeacher } from '@/server/students/shared';
import { APP_TIMEZONE } from '@/shared/config/app';
import { toExceptionView, toScheduleView, type ExceptionView, type ScheduleView } from './shared';

export type ScheduleWithExceptions = ScheduleView & { exceptions: ExceptionView[] };

export type SessionView = {
  id: string;
  studentId: string;
  studentName: string;
  localDate: LocalDate;
  startsAt: Date;
  endsAt: Date;
};

export async function listSchedulesForStudent(
  actor: Actor,
  studentId: string,
): Promise<ScheduleWithExceptions[]> {
  requireTeacher(actor);
  const rows = await prisma.classSchedule.findMany({
    where: { studentId: parseId(studentId) },
    include: { exceptions: { orderBy: { localDate: 'asc' } } },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }, { effectiveFrom: 'asc' }],
  });
  return rows.map((r) => ({ ...toScheduleView(r), exceptions: r.exceptions.map(toExceptionView) }));
}

// Teachers see every active student's sessions. Parents see only sessions of their own children.
export async function listUpcomingSessionsForActor(
  actor: Actor,
  opts: { now?: Date } = {},
): Promise<SessionView[]> {
  const now = opts.now ?? new Date();
  const lastDay = addDays(localDateOf(now, APP_TIMEZONE), SESSION_HORIZON_DAYS - 1);

  let student: object;
  if (actor.role === 'TEACHER') {
    student = { isActive: true };
  } else if (actor.parentId) {
    student = { isActive: true, parents: { some: { parentId: actor.parentId } } };
  } else {
    return [];
  }

  const rows = await prisma.classSession.findMany({
    where: {
      status: 'SCHEDULED',
      endsAt: { gte: now },
      localDate: { lte: toDbDate(lastDay) },
      schedule: { student },
    },
    select: {
      id: true,
      studentId: true,
      localDate: true,
      startsAt: true,
      endsAt: true,
      schedule: { select: { student: { select: { fullName: true } } } },
    },
    orderBy: { startsAt: 'asc' },
    take: 200,
  });

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: r.schedule.student.fullName,
    localDate: fromDbDate(r.localDate),
    startsAt: r.startsAt,
    endsAt: r.endsAt,
  }));
}
