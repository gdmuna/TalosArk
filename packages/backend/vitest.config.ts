import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        tsconfigPaths: true, // Vite 6 原生支持，无需 vite-tsconfig-paths 插件
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
        testTimeout: 30_000,
        typecheck: {
            tsconfig: './tsconfig.test.json',
        },
        coverage: {
            provider: 'v8',
            reporter: ['html', 'lcov', 'text'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{ts,js}'],
            exclude: ['src/**/*.spec.ts', 'src/**/*.e2e-spec.ts', 'src/main.ts'],
        },
    },
});
