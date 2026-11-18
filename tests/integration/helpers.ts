import { prisma } from '@/server/db/prisma';
import { hashPassword } from '@/server/auth/password';
import type { Actor } from '@/server/domain/access-policy';
import { toDbDate } from '@/server/domain/local-date';

export const PASSWORD = 'Passw0rd!Test';

// Safe: setup.ts has already verified this is the test DB.
export async function resetDb() {
  await prisma.$executeRaw`TRUNCATE "ClassSession","ClassScheduleException","ClassSchedule","StudentParent","Parent","Student","AuthSession","AuditEvent","User" CASCADE`;
}

export async function createTeacher(email = 'teacher@example.com') {
  return prisma.user.create({
    data: { email, passwordHash: await hashPassword(PASSWORD), role: 'TEACHER' },
  });
}

export async function createParent(email: string) {
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(PASSWORD), role: 'PARENT' },
  });
  const parent = await prisma.parent.create({ data: { userId: user.id, fullName: email } });
  return { user, parent };
}

export async function createStudent(fullName: string, parentIds: string[] = []) {
  const student = await prisma.student.create({ data: { fullName } });
  for (const parentId of parentIds) {
    await prisma.studentParent.create({ data: { studentId: student.id, parentId } });
  }
  return student;
}

type ScheduleOverrides = Partial<{
  weekday: number;
  startMinute: number;
  durationMinutes: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}>;

// Inserts directly, bypassing the commands (so tests can create schedules that started in the past).
export async function createSchedule(studentId: string, o: ScheduleOverrides = {}) {
  return prisma.classSchedule.create({
    data: {
      studentId,
      weekday: o.weekday ?? 1,
      startMinute: o.startMinute ?? 19 * 60,
      durationMinutes: o.durationMinutes ?? 60,
      effectiveFrom: toDbDate(o.effectiveFrom ?? '2026-11-02'),
      effectiveTo: o.effectiveTo ? toDbDate(o.effectiveTo) : null,
    },
  });
}

export function sessionRow(scheduleId: string, studentId: string, date: string) {
  return {
    scheduleId,
    studentId,
    localDate: toDbDate(date),
    startsAt: new Date(`${date}T14:00:00.000Z`),
    endsAt: new Date(`${date}T15:00:00.000Z`),
  };
}

export const teacherActor = (u: { id: string }): Actor => ({ userId: u.id, role: 'TEACHER' });
export const parentActor = (u: { id: string }, p: { id: string }): Actor => ({
  userId: u.id,
  role: 'PARENT',
  parentId: p.id,
});
