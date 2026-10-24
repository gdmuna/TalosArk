import { test as setup } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, '../.auth/user.json');

async function login(page: Page, username: string, password: string) {
    await page.goto('/login');
    await page.fill('input[name="account"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
}

async function registerAndLogin(page: Page, password: string) {
    const nonce = Date.now().toString(36);
    const username = `e2e_${nonce}`;
    const email = `${username}@example.com`;

    await page.goto('/register');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
}

setup('authenticate as test user', async ({ page }) => {
    const username = process.env.E2E_USER ?? 'user0';
    const password = process.env.E2E_PASSWORD ?? 'password';

    // Ensure the .auth directory exists
    const authDir = path.dirname(authFile);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    await login(page, username, password);

    try {
        // Prefer existing account from env/defaults.
        await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 8_000 });
    } catch {
        // Fallback: auto-register a temporary account if login credentials are unavailable.
        await registerAndLogin(page, password);
        await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 });
    }

    // Wait for the app to fully initialize (nav visible means auth store is ready)
    await page.waitForSelector('nav', { timeout: 5_000 }).catch(() => {});
    // Wait for all in-flight network requests to settle so the refresh cookie is fully persisted
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

    // Persist cookies so authenticated project tests can reuse them
    await page.context().storageState({ path: authFile });
});
