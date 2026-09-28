import eslint from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import vueParser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

// 各工作区共享的基础规则
const commonRules = {
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    'no-console': 'warn',
    'no-debugger': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/explicit-function-return-types': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
};

export default [
    // ── 全局忽略 ──────────────────────────────────────────────
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            'packages/backend/prisma/generated/**',
            'packages/docsite/.vitepress/dist/**',
            'packages/docsite/.vitepress/cache/**',
            'packages/frontend/src-tauri/**',
        ],
    },

    // ── packages/backend: TypeScript ────────
    {
        files: ['packages/backend/src/**/*.ts', 'packages/backend/test/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            globals: {
                ...globals.node,
                ...globals.es2026,
                ...globals.vitest,
                NodeJS: 'readonly',
                Express: 'readonly',
            },
            parserOptions: {
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...tsPlugin.configs.recommended.rules,
            ...commonRules,
        },
    },

    // Shared contracts must not rely on Node.js or browser globals.
    {
        files: ['packages/contract/src/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            globals: globals.es2026,
            parserOptions: {
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...tsPlugin.configs.recommended.rules,
            ...commonRules,
        },
    },

    // ── packages/frontend: Vue 3 + TypeScript ───
    {
        files: ['packages/frontend/src/**/*.{js,ts,vue}'],
        ignores: ['packages/frontend/src/components/ui/**'],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tsParser,
                ecmaVersion: 'latest',
                sourceType: 'module',
                extraFileExtensions: ['.vue'],
            },
            globals: {
                ...globals.browser,
                ...globals.es2026,
            },
        },
        plugins: {
            vue: vuePlugin,
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...tsPlugin.configs.recommended.rules,
            ...vuePlugin.configs.recommended.rules,
            ...commonRules,
            'no-console': 'off',
        },
    },

    // ── 关闭与 Prettier 冲突的格式规则（全局）────────────────
    prettierConfig,
];
