import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';

async function reset() {
  // Safe: setup.ts has already verified this is the test DB.
  await prisma.$executeRaw`TRUNCATE "StudentParent","Parent","Student","AuthSession","AuditEvent","User" CASCADE`;
}

async function makeParent(email: string) {
  const user = await prisma.user.create({ data: { email, passwordHash: 'x', role: 'PARENT' } });
  return prisma.parent.create({ data: { userId: user.id, fullName: 'Parent' } });
}

describe('student_parents', () => {
  beforeEach(reset);

  it('supports many-to-many links', async () => {
    const p1 = await makeParent('a@x.com');
    const p2 = await makeParent('b@x.com');
    const s = await prisma.student.create({ data: { fullName: 'Ali' } });
    await prisma.studentParent.createMany({
      data: [
        { studentId: s.id, parentId: p1.id },
        { studentId: s.id, parentId: p2.id },
      ],
    });
    expect(await prisma.studentParent.count({ where: { studentId: s.id } })).toBe(2);
  });

  it('rejects a duplicate link', async () => {
    const p = await makeParent('a@x.com');
    const s = await prisma.student.create({ data: { fullName: 'Ali' } });
    const link = { studentId: s.id, parentId: p.id };
    await prisma.studentParent.create({ data: link });
    await expect(prisma.studentParent.create({ data: link })).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});
