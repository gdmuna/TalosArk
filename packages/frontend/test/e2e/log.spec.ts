import { test, expect } from '@playwright/test';

// These tests run under the "app" project which loads storageState (auth cookies)

test('navigate to logs page', async ({ page }) => {
    await page.goto('/logs');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/logs/, { timeout: 5_000 });
});

test('logs page shows correct heading', async ({ page }) => {
    await page.goto('/logs', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '操作日志' })).toBeVisible({ timeout: 5_000 });
});

test('logs page shows box logs tab and reagent logs tab', async ({ page }) => {
    await page.goto('/logs', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: /储存盒日志/ })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: /试剂日志/ })).toBeVisible({ timeout: 5_000 });
});

test('logs page shows prompt to select box before loading', async ({ page }) => {
    await page.goto('/logs', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('请先选择一个储存盒以查看操作日志')).toBeVisible({
        timeout: 5_000,
    });
});

test('switch to reagent logs tab shows prompt to select reagent', async ({ page }) => {
    await page.goto('/logs', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /试剂日志/ }).click();
    await expect(page.getByText('请先选择一个试剂以查看操作日志')).toBeVisible({ timeout: 5_000 });
});

test('logs page sidebar link is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /操作日志/ })).toBeVisible({ timeout: 5_000 });
});
