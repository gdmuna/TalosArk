import { test, expect } from '@playwright/test';

test('open create box page from box list', async ({ page }) => {
    await page.goto('/box');
    await page.getByRole('button', { name: '新建' }).click();
    await expect(page).toHaveURL(/\/box\/new/);
    await expect(page.getByRole('heading', { name: '新建储存盒' })).toBeVisible();
});
