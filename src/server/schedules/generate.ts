import type { DbClient } from '@/server/db/client-type';
import { addDays, fromDbDate, localDateOf, toDbDate } from '@/server/domain/local-date';
import { planSessions, SESSION_HORIZON_DAYS } from '@/server/domain/schedule-planning';
import { APP_TIMEZONE } from '@/shared/config/app';

/**
 * Creates any missing sessions for today .. today+27 (Karachi). Safe to call repeatedly and
 * concurrently: UNIQUE(scheduleId, localDate) plus skipDuplicates makes it idempotent.
 */
export async function generateUpcomingSessions(
  db: DbClient,
  now: Date = new Date(),
): Promise<{ created: number }> {
  const today = localDateOf(now, APP_TIMEZONE);
  const to = addDays(today, SESSION_HORIZON_DAYS - 1);

  const rows = await db.classSchedule.findMany({
    where: {
      student: { isActive: true },
      effectiveFrom: { lte: toDbDate(to) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: toDbDate(today) } }],
    },
    include: {
      exceptions: { where: { localDate: { gte: toDbDate(today), lte: toDbDate(to) } } },
    },
  });

  const planned = planSessions({
    schedules: rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      weekday: r.weekday,
      startMinute: r.startMinute,
      durationMinutes: r.durationMinutes,
      timezone: r.timezone,
      effectiveFrom: fromDbDate(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? fromDbDate(r.effectiveTo) : null,
    })),
    exceptions: rows.flatMap((r) =>
      r.exceptions.map((e) => ({ scheduleId: r.id, localDate: fromDbDate(e.localDate) })),
    ),
    from: today,
    to,
  });
  if (planned.length === 0) return { created: 0 };

  const result = await db.classSession.createMany({
    data: planned.map((p) => ({
      scheduleId: p.scheduleId,
      studentId: p.studentId,
      localDate: toDbDate(p.localDate),
      startsAt: p.startsAt,
      endsAt: p.endsAt,
    })),
    skipDuplicates: true,
  });
  return { created: result.count };
}
