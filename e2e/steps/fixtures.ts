import { test as base, createBdd } from 'playwright-bdd';

export type World = {
  suffix: string;
  email: string;
  parentId?: string;
  ownStudentId?: string;
  otherStudentId?: string;
  otherStudentName?: string;
  lastStatus?: number;
  lastBody?: string;
  teacherEmail?: string;
  parentName?: string;
  parentEmail?: string;
  studentNames?: string[];
};

export const test = base.extend<{ world: World }>({
  world: async ({}, use) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await use({ suffix, email: `parent-${suffix}@example.com` });
  },
});

export const { Given, When, Then } = createBdd(test);
