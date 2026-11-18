import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { ForbiddenError } from '@/server/domain/errors';
import { toDbDate } from '@/server/domain/local-date';
import { generateUpcomingSessions } from '@/server/schedules/generate';
import {
  listSchedulesForStudent,
  listUpcomingSessionsForActor,
} from '@/server/schedules/schedule-queries';
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

const NOW = new Date('2026-11-18T08:00:00Z');

describe('upcoming sessions visibility', () => {
  beforeEach(resetDb);

  async function setup() {
    const t = await createTeacher();
    const a = await createParent('a@example.com');
    const b = await createParent('b@example.com');
    const ali = await createStudent('Ali', [a.parent.id]);
    const sara = await createStudent('Sara', [b.parent.id]);
    await createSchedule(ali.id, { weekday: 1, effectiveFrom: '2026-11-16' });
    await createSchedule(sara.id, { weekday: 1, effectiveFrom: '2026-11-16' });
    await generateUpcomingSessions(prisma, NOW);
    return { t, a, b, ali, sara };
  }

  it('shows a parent only their own children’s sessions', async () => {
    const { a } = await setup();
    const list = await listUpcomingSessionsForActor(parentActor(a.user, a.parent), { now: NOW });
    expect(list).toHaveLength(4);
    expect(list.every((s) => s.studentName === 'Ali')).toBe(true);
  });

  it('shows the teacher everyone, and a parent without a profile nothing', async () => {
    const { t } = await setup();
    expect(await listUpcomingSessionsForActor(teacherActor(t), { now: NOW })).toHaveLength(8);
    expect(
      await listUpcomingSessionsForActor({ userId: 'x', role: 'PARENT' }, { now: NOW }),
    ).toEqual([]);
  });

  it('hides finished, cancelled and deactivated-student sessions', async () => {
    const { t, ali, sara } = await setup();
    const sch = await prisma.classSchedule.findFirstOrThrow({ where: { studentId: ali.id } });
    await prisma.classSession.create({ data: sessionRow(sch.id, ali.id, '2026-11-17') }); // already ended
    await prisma.classSession.updateMany({
      where: { studentId: ali.id, localDate: toDbDate('2026-11-23') },
      data: { status: 'CANCELLED' },
    });
    await prisma.student.update({ where: { id: sara.id }, data: { isActive: false } });

    const list = await listUpcomingSessionsForActor(teacherActor(t), { now: NOW });
    expect(list.every((s) => s.studentName === 'Ali')).toBe(true);
    expect(list).toHaveLength(3); // Nov 30, Dec 7, Dec 14
  });
});

describe('listSchedulesForStudent', () => {
  beforeEach(resetDb);

  it('is teacher-only and includes exceptions', async () => {
    const t = await createTeacher();
    const a = await createParent('a@example.com');
    const s = await createStudent('Ali', [a.parent.id]);
    const sch = await createSchedule(s.id, { weekday: 3 });
    await prisma.classScheduleException.create({
      data: { scheduleId: sch.id, localDate: toDbDate('2026-11-25'), reason: 'Eid' },
    });

    const list = await listSchedulesForStudent(teacherActor(t), s.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ weekday: 3, startTime: '19:00' });
    expect(list[0].exceptions).toEqual([
      expect.objectContaining({ localDate: '2026-11-25', reason: 'Eid' }),
    ]);

    await expect(
      listSchedulesForStudent(parentActor(a.user, a.parent), s.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
