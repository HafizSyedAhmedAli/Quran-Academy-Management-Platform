import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { resetDb, createStudent, createSchedule, sessionRow } from './helpers';

describe('schedule constraints (PostgreSQL)', () => {
  beforeEach(resetDb);

  it('rejects a weekday outside 1..7', async () => {
    const s = await createStudent('Ali');
    await expect(createSchedule(s.id, { weekday: 8 })).rejects.toThrow();
    await expect(createSchedule(s.id, { weekday: 0 })).rejects.toThrow();
  });

  it('rejects a bad start minute, a bad duration and a reversed date range', async () => {
    const s = await createStudent('Ali');
    await expect(createSchedule(s.id, { startMinute: 1440 })).rejects.toThrow();
    await expect(createSchedule(s.id, { startMinute: -1 })).rejects.toThrow();
    await expect(createSchedule(s.id, { durationMinutes: 4 })).rejects.toThrow();
    await expect(createSchedule(s.id, { durationMinutes: 481 })).rejects.toThrow();
    await expect(
      createSchedule(s.id, { effectiveFrom: '2026-11-10', effectiveTo: '2026-11-09' }),
    ).rejects.toThrow();
  });

  it('rejects overlapping ranges for the same slot, but allows adjacent ranges, other times and other students', async () => {
    const a = await createStudent('Ali');
    const b = await createStudent('Sara');
    await createSchedule(a.id, { effectiveFrom: '2026-11-02', effectiveTo: '2026-11-29' });

    await expect(createSchedule(a.id, { effectiveFrom: '2026-11-15' })).rejects.toThrow();
    await expect(createSchedule(a.id, { effectiveFrom: '2026-11-02' })).rejects.toThrow();

    await createSchedule(a.id, { effectiveFrom: '2026-11-30' }); // adjacent, open-ended
    await createSchedule(a.id, { startMinute: 20 * 60, effectiveFrom: '2026-11-02' }); // other time
    await createSchedule(b.id, { effectiveFrom: '2026-11-02' }); // other student
    expect(await prisma.classSchedule.count()).toBe(4);
  });

  it('allows only one session per schedule and date', async () => {
    const s = await createStudent('Ali');
    const sch = await createSchedule(s.id);
    await prisma.classSession.create({ data: sessionRow(sch.id, s.id, '2026-11-23') });
    await expect(
      prisma.classSession.create({ data: sessionRow(sch.id, s.id, '2026-11-23') }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it("rejects a session whose student differs from its schedule's student", async () => {
    const a = await createStudent('Ali');
    const b = await createStudent('Sara');
    const sch = await createSchedule(a.id);
    await expect(
      prisma.classSession.create({ data: sessionRow(sch.id, b.id, '2026-11-23') }),
    ).rejects.toThrow();
  });

  it('rejects a session that ends before it starts', async () => {
    const s = await createStudent('Ali');
    const sch = await createSchedule(s.id);
    const row = sessionRow(sch.id, s.id, '2026-11-23');
    await expect(
      prisma.classSession.create({ data: { ...row, endsAt: row.startsAt } }),
    ).rejects.toThrow();
  });

  it('protects history: a schedule with sessions, or a student with schedules, cannot be deleted', async () => {
    const s = await createStudent('Ali');
    const sch = await createSchedule(s.id);
    await prisma.classSession.create({ data: sessionRow(sch.id, s.id, '2026-11-23') });
    await expect(prisma.classSchedule.delete({ where: { id: sch.id } })).rejects.toThrow();
    await expect(prisma.student.delete({ where: { id: s.id } })).rejects.toThrow();
  });
});
