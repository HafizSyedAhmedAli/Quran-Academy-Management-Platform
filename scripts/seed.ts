import { prisma } from '../src/server/db/prisma';
import { hashPassword } from '../src/server/auth/password';

async function upsertUser(email: string, password: string, role: 'TEACHER' | 'PARENT') {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await hashPassword(password), role },
  });
}

async function upsertParent(email: string, password: string, fullName: string) {
  const user = await upsertUser(email, password, 'PARENT');
  return prisma.parent.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, fullName },
  });
}

async function ensureStudent(fullName: string, parentId: string) {
  const s =
    (await prisma.student.findFirst({ where: { fullName } })) ??
    (await prisma.student.create({ data: { fullName } }));
  await prisma.studentParent.upsert({
    where: { studentId_parentId: { studentId: s.id, parentId } },
    update: {},
    create: { studentId: s.id, parentId },
  });
}

async function main() {
  const dbName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (dbName !== 'quran_academy_dev') throw new Error(`Refusing to seed "${dbName}"`);

  await upsertUser('teacher@example.com', 'Teacher#12345', 'TEACHER');
  const a = await upsertParent('parenta@example.com', 'ParentA#12345', 'Parent A');
  const b = await upsertParent('parentb@example.com', 'ParentB#12345', 'Parent B');
  await ensureStudent('Ali Khan', a.id);
  await ensureStudent('Sara Noor', b.id);
  console.log('Seeded dev data.');
}

main().finally(() => prisma.$disconnect());
