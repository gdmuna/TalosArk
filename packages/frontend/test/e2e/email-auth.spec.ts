import { test, expect } from '@playwright/test';

test('email login page loads', async ({ page }) => {
    await page.goto('/login/email');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="code"]')).toBeVisible();
});
