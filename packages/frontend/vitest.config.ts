import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    plugins: [vue()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./test/setup.ts'],
        include: ['test/unit/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['html', 'lcov', 'text'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{ts,vue}'],
            exclude: ['src/main.ts', 'src/**/*.spec.ts', 'src/components/ui/**'],
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
