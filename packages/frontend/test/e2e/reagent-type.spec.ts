import { test, expect } from '@playwright/test';

// These tests run under the "app" project which loads storageState (auth cookies)

test('navigate to reagent type page', async ({ page }) => {
    await page.goto('/reagent-type');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/reagent-type/, { timeout: 5_000 });
});

test('reagent type page shows correct heading', async ({ page }) => {
    await page.goto('/reagent-type', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '试剂类型管理' })).toBeVisible({
        timeout: 5_000,
    });
});

test('reagent type page has create button', async ({ page }) => {
    await page.goto('/reagent-type', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /新建类型/ })).toBeVisible({ timeout: 5_000 });
});

test('open create dialog and fill in name', async ({ page }) => {
    await page.goto('/reagent-type', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /新建类型/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await dialog.getByPlaceholder(/DNA/).fill('E2E Test Type');
    await expect(dialog.getByPlaceholder(/DNA/)).toHaveValue('E2E Test Type');
});

test('reagent type sidebar link is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /试剂类型/ })).toBeVisible({ timeout: 5_000 });
});

test('reagent page no longer embeds type management tab', async ({ page }) => {
    await page.goto('/reagent', { waitUntil: 'domcontentloaded' });
    // The old "试剂类型" tab should not be present in the reagent page tabs
    const typesTab = page.getByRole('tab', { name: '试剂类型' });
    await expect(typesTab).not.toBeVisible();
});
