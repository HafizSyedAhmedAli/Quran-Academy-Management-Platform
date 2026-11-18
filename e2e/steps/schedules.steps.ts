import { expect } from '@playwright/test';
import { prisma } from '@/server/db/prisma';
import { hashPassword } from '@/server/auth/password';
import type { Actor } from '@/server/domain/access-policy';
import { addDays, isoWeekday, localDateOf } from '@/server/domain/local-date';
import { createSchedules } from '@/server/schedules/schedule-commands';
import { WEEKDAYS } from '@/entities/schedule';
import { APP_TIMEZONE } from '@/shared/config/app';
import { Given, When, Then, type World } from './fixtures';

const PARENT_PASSWORD = 'E2e#Parent12345';
const unique = (w: World, name: string) => `${name} ${w.suffix}`;
const tomorrow = () => addDays(localDateOf(new Date(), APP_TIMEZONE), 1);

async function teacherActor(world: World): Promise<Actor> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: world.teacherEmail! } });
  return { userId: user.id, role: 'TEACHER' };
}

Given(
  'a student named {string} exists with a weekly class starting tomorrow',
  async ({ world }, name: string) => {
    const fullName = unique(world, name);
    const student = await prisma.student.create({ data: { fullName } });
    world.studentNames = [...(world.studentNames ?? []), fullName];
    const day = tomorrow();
    await createSchedules(await teacherActor(world), {
      studentId: student.id,
      weekdays: [isoWeekday(day)],
      startTime: '19:00',
      durationMinutes: 60,
      effectiveFrom: day,
    });
  },
);

Given('a parent account is linked only to {string}', async ({ world }, name: string) => {
  world.parentEmail = `guardian-${world.suffix}@example.com`;
  const user = await prisma.user.create({
    data: {
      email: world.parentEmail,
      passwordHash: await hashPassword(PARENT_PASSWORD),
      role: 'PARENT',
    },
  });
  const parent = await prisma.parent.create({
    data: { userId: user.id, fullName: 'E2E Guardian' },
  });
  const student = await prisma.student.findFirstOrThrow({
    where: { fullName: unique(world, name) },
  });
  await prisma.studentParent.create({ data: { studentId: student.id, parentId: parent.id } });
});

When(
  'the teacher schedules a weekly class for {string} starting tomorrow at {string}',
  async ({ page, world }, name: string, time: string) => {
    world.studentNames = [...(world.studentNames ?? []), unique(world, name)];
    const day = tomorrow();
    await page.goto('/teacher/students');
    await page.getByRole('link', { name: unique(world, name) }).click();
    await page.getByRole('link', { name: 'Manage schedule' }).click();
    await page.getByLabel(WEEKDAYS[isoWeekday(day) - 1].label, { exact: true }).check();
    await page.getByLabel('Start time').fill(time);
    await page.getByLabel('Start date').fill(day);
    await page.getByRole('button', { name: 'Add schedule' }).click();
    await expect(page.getByTestId('schedule-item')).toHaveCount(1);
  },
);

When('the teacher skips the class on that date', async ({ page, world }) => {
  const name = world.studentNames!.at(-1)!;
  await page.goto('/teacher/students');
  await page.getByRole('link', { name }).click();
  await page.getByRole('link', { name: 'Manage schedule' }).click();
  await page.getByLabel('Date to skip').fill(tomorrow());
  await page.getByRole('button', { name: 'Skip date' }).click();
  await expect(page.getByTestId('exception-item')).toHaveCount(1);
});

Then(
  '{string} has {int} upcoming sessions starting at {string}',
  async ({ page, world }, name: string, count: number, time: string) => {
    await page.goto('/teacher/schedule');
    const items = page.getByTestId('session-item').filter({ hasText: unique(world, name) });
    await expect(items).toHaveCount(count);
    await expect(items.first()).toContainText(time);
  },
);

Then(
  '{string} has {int} upcoming sessions',
  async ({ page, world }, name: string, count: number) => {
    await page.goto('/teacher/schedule');
    await expect(
      page.getByTestId('session-item').filter({ hasText: unique(world, name) }),
    ).toHaveCount(count);
  },
);

When('the parent logs in', async ({ page, world }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(world.parentEmail!);
  await page.getByLabel('Password').fill(PARENT_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/parent');
});

Then(
  'the parent sees upcoming sessions only for {string}',
  async ({ page, world }, name: string) => {
    const own = unique(world, name);
    const items = page.getByTestId('session-item');
    await expect(items).toHaveCount(4);
    for (const item of await items.all()) await expect(item).toContainText(own);
    for (const other of world.studentNames!.filter((n) => n !== own)) {
      await expect(page.locator('body')).not.toContainText(other);
    }
  },
);
