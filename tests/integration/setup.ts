import { beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/prisma';

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const dbName = url.pathname.replace('/', '');
  if (dbName !== 'quran_academy_test' || url.port !== '5433') {
    throw new Error(`Refusing to run: not the test DB (${dbName}:${url.port})`);
  }
  const [{ current_database }] = await prisma.$queryRaw<{ current_database: string }[]>`
    SELECT current_database()`;
  if (current_database !== 'quran_academy_test') {
    throw new Error(`Connected DB is ${current_database}, expected quran_academy_test`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
