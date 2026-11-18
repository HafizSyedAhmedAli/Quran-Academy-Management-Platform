import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { generateUpcomingSessions } from '@/server/schedules/generate';
import { toDbDate } from '@/server/domain/local-date';
import { resetDb, createStudent, createSchedule } from './helpers';

const NOW = new Date('2026-11-18T08:00:00Z'); // 13:00 in Karachi, Wednesday
const day = (d: Date) => d.toISOString().slice(0, 10);

async function mwf(studentId: string) {
  for (const weekday of [1, 3, 5]) {
    await createSchedule(studentId, { weekday, effectiveFrom: '2026-11-16' });
  }
}

describe('session generation', () => {
  beforeEach(resetDb);

  it('generates a bounded 28-day window at the right UTC times', async () => {
    const s = await createStudent('Ali');
    await mwf(s.id);

    const { created } = await generateUpcomingSessions(prisma, NOW);
    expect(created).toBe(12);

    const rows = await prisma.classSession.findMany({ orderBy: { startsAt: 'asc' } });
    expect(rows).toHaveLength(12);
    expect(day(rows[0].localDate)).toBe('2026-11-18'); // nothing before today
    expect(day(rows[rows.length - 1].localDate)).toBe('2026-12-14');
    expect(
      rows.every((r) => r.startsAt.getUTCHours() === 14 && r.startsAt.getUTCMinutes() === 0),
    ).toBe(true);
    expect(rows[0].endsAt.getTime() - rows[0].startsAt.getTime()).toBe(60 * 60 * 1000);
    expect(rows.every((r) => r.status === 'SCHEDULED')).toBe(true);
  });

  it('is idempotent, including under concurrent runs', async () => {
    const s = await createStudent('Ali');
    await mwf(s.id);
    await generateUpcomingSessions(prisma, NOW);
    expect((await generateUpcomingSessions(prisma, NOW)).created).toBe(0);
    await Promise.all([
      generateUpcomingSessions(prisma, NOW),
      generateUpcomingSessions(prisma, NOW),
      generateUpcomingSessions(prisma, NOW),
    ]);
    expect(await prisma.classSession.count()).toBe(12);
  });

  it('only adds the newly reachable days when the window moves forward', async () => {
    const s = await createStudent('Ali');
    await mwf(s.id);
    await generateUpcomingSessions(prisma, NOW);
    const later = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect((await generateUpcomingSessions(prisma, later)).created).toBe(3);
    expect(await prisma.classSession.count()).toBe(15);
  });

  it('does not generate for deactivated students', async () => {
    const s = await createStudent('Ali');
    await mwf(s.id);
    await prisma.student.update({ where: { id: s.id }, data: { isActive: false } });
    expect((await generateUpcomingSessions(prisma, NOW)).created).toBe(0);
  });

  it('respects effectiveTo and exceptions', async () => {
    const s = await createStudent('Ali');
    const sch = await createSchedule(s.id, {
      weekday: 3,
      effectiveFrom: '2026-11-16',
      effectiveTo: '2026-12-02',
    });
    await prisma.classScheduleException.create({
      data: { scheduleId: sch.id, localDate: toDbDate('2026-11-25') },
    });
    await generateUpcomingSessions(prisma, NOW);
    const dates = (await prisma.classSession.findMany({ orderBy: { startsAt: 'asc' } })).map((r) =>
      day(r.localDate),
    );
    expect(dates).toEqual(['2026-11-18', '2026-12-02']);
  });

  it('never resurrects a cancelled session', async () => {
    const s = await createStudent('Ali');
    await createSchedule(s.id, { weekday: 3, effectiveFrom: '2026-11-16' });
    await generateUpcomingSessions(prisma, NOW);
    await prisma.classSession.updateMany({
      where: { localDate: toDbDate('2026-11-18') },
      data: { status: 'CANCELLED' },
    });
    await generateUpcomingSessions(prisma, NOW);
    const first = await prisma.classSession.findMany({
      where: { localDate: toDbDate('2026-11-18') },
    });
    expect(first).toHaveLength(1);
    expect(first[0].status).toBe('CANCELLED');
  });
});
