import { test as base, createBdd } from 'playwright-bdd';

export type World = {
  email: string;
  parentId?: string;
  ownStudentId?: string;
  otherStudentId?: string;
  otherStudentName?: string;
  lastStatus?: number;
  lastBody?: string;
};

export const test = base.extend<{ world: World }>({
  world: async ({}, use) => {
    await use({ email: `parent-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com` });
  },
});

export const { Given, When, Then } = createBdd(test);
