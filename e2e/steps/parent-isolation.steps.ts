import { expect } from '@playwright/test';
import { prisma } from '@/server/db/prisma';
import { hashPassword } from '@/server/auth/password';
import { Given, When, Then } from './fixtures';

const PASSWORD = 'E2e#Passw0rd';

Given('a parent is authenticated', async ({ page, world }) => {
  const user = await prisma.user.create({
    data: { email: world.email, passwordHash: await hashPassword(PASSWORD), role: 'PARENT' },
  });
  const parent = await prisma.parent.create({ data: { userId: user.id, fullName: 'E2E Parent' } });
  world.parentId = parent.id;

  await page.goto('/login');
  await page.getByLabel('Email').fill(world.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/parent');
});

Given('the student is associated with that parent', async ({ world }) => {
  const student = await prisma.student.create({ data: { fullName: `Own ${world.email}` } });
  await prisma.studentParent.create({
    data: { studentId: student.id, parentId: world.parentId! },
  });
  world.ownStudentId = student.id;
});

Given('a student is not associated with that parent', async ({ world }) => {
  const student = await prisma.student.create({ data: { fullName: `Secret ${world.email}` } });
  world.otherStudentId = student.id;
  world.otherStudentName = student.fullName;
});

When('the parent requests the student dashboard', async ({ page, world }) => {
  await page.goto(`/parent/students/${world.ownStudentId}`);
});

Then("the application displays that student's information", async ({ page, world }) => {
  await expect(page.getByTestId('student-name')).toHaveText(`Own ${world.email}`);
});

When("the parent requests that student's information", async ({ page, world }) => {
  const res = await page.request.get(`/api/students/${world.otherStudentId}`);
  world.lastStatus = res.status();
  world.lastBody = await res.text();
  await page.goto(`/parent/students/${world.otherStudentId}`);
});

Then('the application rejects the request', async ({ page, world }) => {
  expect(world.lastStatus).toBe(404);
  await expect(page.getByTestId('student-name')).toHaveCount(0);
});

Then('no unauthorized student data is returned', async ({ page, world }) => {
  expect(world.lastBody).not.toContain(world.otherStudentName!);
  await expect(page.locator('body')).not.toContainText(world.otherStudentName!);
});
