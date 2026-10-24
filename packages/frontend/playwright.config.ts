import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './test/e2e',
    use: {
        baseURL: 'http://localhost:8081',
        headless: true,
    },
    projects: [
        // 1. Auth setup — logs in and saves cookie state
        {
            name: 'setup',
            testMatch: /global\.setup\.ts/,
        },
        // 2. Unauthenticated tests (login / register pages)
        {
            name: 'public',
            testMatch: /(auth|register|email-auth)\.spec\.ts/,
        },
        // 3. Authenticated tests — all other specs
        {
            name: 'app',
            use: { storageState: 'test/.auth/user.json' },
            dependencies: ['setup'],
            testIgnore: /(auth|register|email-auth)\.spec\.ts|global\.setup\.ts/,
        },
    ],
    webServer: {
        command: 'pnpm dev',
        port: 8081,
        reuseExistingServer: true,
        timeout: 30_000,
    },
});
