import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given('the application is running', async () => {});

When('I open the home page', async ({ page }) => {
  await page.goto('/');
});

Then('I see the page load successfully', async ({ page }) => {
  await expect(page.locator('body')).toBeVisible();
});

Given('a parent is authenticated', async () => {
  throw new Error('Not implemented (@wip)');
});

Given('the student is associated with that parent', async () => {
  throw new Error('Not implemented (@wip)');
});

When('the parent requests the student dashboard', async () => {
  throw new Error('Not implemented (@wip)');
});

Then("the application displays that student's information", async () => {
  throw new Error('Not implemented (@wip)');
});

Given('a student is not associated with that parent', async () => {
  throw new Error('Not implemented (@wip)');
});

When("the parent requests that student's information", async () => {
  throw new Error('Not implemented (@wip)');
});

Then('the application rejects the request', async () => {
  throw new Error('Not implemented (@wip)');
});

Then('no unauthorized student data is returned', async () => {
  throw new Error('Not implemented (@wip)');
});
