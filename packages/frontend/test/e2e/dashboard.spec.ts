import { test, expect } from '@playwright/test';

// These tests run under the "app" project which loads storageState (auth cookies)

test('dashboard redirects correctly after auth', async ({ page }) => {
    await page.goto('/dashboard');
    // Should stay on dashboard, not redirect to login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });
});

test('dashboard shows welcome content', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    // Some top-level content should be visible
    await expect(page.locator('main, [role="main"], .content, h1, h2').first()).toBeVisible({
        timeout: 5_000,
    });
});

test('sidebar navigation is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 5_000 });
});

test('navigating to /box does not redirect to login', async ({ page }) => {
    await page.goto('/box');
    await expect(page).not.toHaveURL(/\/login/);
});

test('unauthenticated request to / redirects to login or dashboard', async ({ page }) => {
    // Accessing root "/" should land somewhere valid (not 404)
    await page.goto('/');
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard|box)/);
});
