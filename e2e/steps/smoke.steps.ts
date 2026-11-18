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
