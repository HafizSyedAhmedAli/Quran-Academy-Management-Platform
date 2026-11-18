import { prisma } from '@/server/db/prisma';
import { hashPassword } from '@/server/auth/password';
import type { Actor } from '@/server/domain/access-policy';

export const PASSWORD = 'Passw0rd!Test';

// Safe: setup.ts has already verified this is the test DB.
export async function resetDb() {
  await prisma.$executeRaw`TRUNCATE "StudentParent","Parent","Student","AuthSession","AuditEvent","User" CASCADE`;
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

export const teacherActor = (u: { id: string }): Actor => ({ userId: u.id, role: 'TEACHER' });
export const parentActor = (u: { id: string }, p: { id: string }): Actor => ({
  userId: u.id,
  role: 'PARENT',
  parentId: p.id,
});
