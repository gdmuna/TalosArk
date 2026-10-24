import { test, expect } from '@playwright/test';

test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="account"]')).toBeVisible();
});

test('invalid login shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="account"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
});
