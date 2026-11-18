import { expect } from '@playwright/test';
import { prisma } from '@/server/db/prisma';
import { hashPassword } from '@/server/auth/password';
import { Given, When, Then, type World } from './fixtures';

const TEACHER_PASSWORD = 'E2e#Teacher123';
const PARENT_PASSWORD = 'E2e#Parent12345';
const unique = (w: World, name: string) => `${name} ${w.suffix}`;

Given('a teacher is authenticated', async ({ page, world }) => {
  world.teacherEmail = `teacher-${world.suffix}@example.com`;
  await prisma.user.create({
    data: {
      email: world.teacherEmail,
      passwordHash: await hashPassword(TEACHER_PASSWORD),
      role: 'TEACHER',
    },
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill(world.teacherEmail);
  await page.getByLabel('Password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/teacher');
});

Given('a student named {string} exists', async ({ world }, name: string) => {
  await prisma.student.create({ data: { fullName: unique(world, name) } });
});

When('the teacher adds a student named {string}', async ({ page, world }, name: string) => {
  await page.goto('/teacher/students');
  await page.getByLabel('Full name').fill(unique(world, name));
  await page.getByRole('button', { name: 'Add student' }).click();
});

Then('the student {string} appears in the student list', async ({ page, world }, name: string) => {
  await expect(
    page.getByTestId('student-item').filter({ hasText: unique(world, name) }),
  ).toBeVisible();
});

When(
  'the teacher adds a parent with a unique email and a WhatsApp number',
  async ({ page, world }) => {
    world.parentName = `Parent ${world.suffix}`;
    world.parentEmail = `guardian-${world.suffix}@example.com`;
    await page.goto('/teacher/parents');
    await page.getByLabel('Full name').fill(world.parentName);
    await page.getByLabel('Email').fill(world.parentEmail);
    await page.getByLabel('WhatsApp number').fill('+92 300 1234567');
    await page.getByLabel('Temporary password').fill(PARENT_PASSWORD);
    await page.getByRole('button', { name: 'Add parent' }).click();
    await expect(
      page.getByTestId('parent-item').filter({ hasText: world.parentEmail }),
    ).toBeVisible();
  },
);

When('the teacher links that parent to {string}', async ({ page, world }, name: string) => {
  await page.goto('/teacher/students');
  await page.getByRole('link', { name: unique(world, name) }).click();
  await page
    .getByLabel('Parent', { exact: true })
    .selectOption({ label: `${world.parentName!} (${world.parentEmail!})` });
  await page.getByRole('button', { name: 'Link parent' }).click();
  await expect(page.getByTestId('linked-parent')).toContainText(world.parentEmail!);
});

Then('the parent can log in and sees {string} only', async ({ page, world }, name: string) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(world.parentEmail!);
  await page.getByLabel('Password').fill(PARENT_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/parent');
  const items = page.getByTestId('student-item');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText(unique(world, name));
});

When('the teacher deactivates {string}', async ({ page, world }, name: string) => {
  await page.goto('/teacher/students');
  await page.getByRole('link', { name: unique(world, name) }).click();
  await page.getByRole('button', { name: 'Deactivate student' }).click();
});

Then('the student is shown as inactive', async ({ page }) => {
  await expect(page.getByTestId('student-status')).toHaveText('Inactive');
});
