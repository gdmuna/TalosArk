import { defineConfig } from 'vitepress';
import { tasklist } from '@mdit/plugin-tasklist';
import { existsSync } from 'node:fs';

// const localeToOgLocaleMap: Record<string, string> = {
//     root: 'zh_CN',
//     en: 'en_US',
// };

export default defineConfig({
    title: 'TalosArk',
    description: '生物样本储存管理系统',
    lang: 'zh-Hans',

    // Published documentation belongs to this package, not backend's internal docs.
    srcDir: './docs',
    // Build output: packages/docsite/dist.
    outDir: './dist',
    // 缓存目录
    cacheDir: './.vitepress/cache',

    // 排除内部规范文件，避免 rewrites 后产生重复路由
    srcExclude: ['**/STANDARD.md', '**/AGENTS.md', 'README.md'],

    // 忽略所有 localhost 链接造成的死链
    ignoreDeadLinks: [/^https?:\/\/localhost/],

    base: process.env.VITE_BASE_PATH ?? '/',

    lastUpdated: existsSync(new URL('../../../.git', import.meta.url)),
    cleanUrls: true,
    metaChunk: true,

    themeConfig: {
        nav: [
            { text: '首页', link: '/' },
            { text: '运行与交付', link: '/guide/quick-start', activeMatch: '/guide/' },
            {
                text: '后端配置',
                link: '/reference/backend/environment/',
                activeMatch: '/reference/backend/environment/',
            },
            {
                text: 'API 参考文档',
                link: process.env.VITE_API_REFERENCE_URL ?? '/api-reference/',
                target: '_blank',
            },
        ],

        sidebar: [
            { text: '项目状态', link: '/' },
            { text: '运行与交付', link: '/guide/quick-start' },
            {
                text: '后端配置',
                items: [
                    { text: '配置概览', link: '/reference/backend/environment/' },
                    { text: '加载与生效', link: '/reference/backend/environment/loading' },
                    { text: 'HTTP 与浏览器来源', link: '/reference/backend/environment/http' },
                ],
            },
        ],
        // 内置本地全文搜索
        search: {
            provider: 'local',
            options: {
                locales: {
                    root: {
                        translations: {
                            button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
                            modal: {
                                displayDetails: '显示详细结果',
                                noResultsText: '无法找到相关结果',
                                resetButtonTitle: '清除查询条件',
                                backButtonTitle: '关闭搜索',
                                footer: {
                                    selectText: '选择',
                                    navigateText: '切换',
                                    closeText: '关闭',
                                },
                            },
                        },
                    },
                    en: {
                        translations: {
                            button: { buttonText: 'Search docs', buttonAriaLabel: 'Search docs' },
                            modal: {
                                noResultsText: 'No results found',
                                resetButtonTitle: 'Clear query',
                                footer: {
                                    selectText: 'Select',
                                    navigateText: 'Navigate',
                                    closeText: 'Close',
                                },
                            },
                        },
                    },
                },
            },
        },

        socialLinks: [{ icon: 'github', link: 'https://github.com/gdmuna/TalosArk' }],

        footer: {
            message:
                '基于 <a href="https://github.com/gdmuna/TalosArk/blob/dev/LICENSE">AGPL-3.0 许可</a> 发布',
            copyright: `版权所有 © 2024-至今 <a href="https://github.com/gdmuna">GDMU-NA & GDMU-ACM</a>`,
        },

        editLink: {
            pattern: 'https://github.com/gdmuna/TalosArk/edit/dev/packages/docsite/docs/:path',
            text: '在 GitHub 上编辑此页',
        },

        lastUpdated: {
            text: '最后更新于',
        },

        outline: {
            label: '页面导航',
        },

        docFooter: {
            prev: '上一页',
            next: '下一页',
        },

        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '切换语言',

        i18nRouting: true,
    },

    vite: {
        server: {
            port: Number(process.env.VITE_API_DOCS_PORT || 5173),
        },
        ssr: {
            // vitepress-mermaid-renderer 包含浏览器 API，SSR 时不打包
            noExternal: ['vitepress-mermaid-renderer'],
        },
    },

    markdown: {
        math: true,
        config: (md) => {
            const fence = md.renderer.rules.fence!;
            md.renderer.rules.fence = function (tokens, idx, options, env, self) {
                const { localeIndex = 'root' } = env;
                const codeCopyButtonTitle = (() => {
                    switch (localeIndex) {
                        case 'en':
                            return 'Copy code';
                        default:
                            return '复制代码';
                    }
                })();
                return fence(tokens, idx, options, env, self).replace(
                    '<button title="Copy Code" class="copy"></button>',
                    `<button title="${codeCopyButtonTitle}" class="copy"></button>`
                );
            };
            // 渲染 GitHub 风格的 task list（- [ ] / - [x]）
            md.use(tasklist);
        },
    },

    locales: {
        root: { label: '简体中文', lang: 'zh-Hans', dir: 'ltr' },
        en: {
            label: 'English',
            lang: 'en-US',
            dir: 'ltr',
            description: 'Biological sample storage management system',
            themeConfig: {
                nav: [
                    { text: 'Home', link: '/en/' },
                    {
                        text: 'Runtime and Delivery',
                        link: '/en/guide/quick-start',
                        activeMatch: '/en/guide/',
                    },
                    {
                        text: 'Backend Configuration',
                        link: '/en/reference/backend/environment/',
                        activeMatch: '/en/reference/backend/environment/',
                    },
                    {
                        text: 'API Reference',
                        link: process.env.VITE_API_REFERENCE_URL ?? '/api-reference/',
                        target: '_blank',
                    },
                ],
                sidebar: [
                    { text: 'Project Status', link: '/en/' },
                    { text: 'Runtime and Delivery', link: '/en/guide/quick-start' },
                    {
                        text: 'Backend Configuration',
                        items: [
                            { text: 'Overview', link: '/en/reference/backend/environment/' },
                            {
                                text: 'Loading and Activation',
                                link: '/en/reference/backend/environment/loading',
                            },
                            {
                                text: 'HTTP and Browser Origins',
                                link: '/en/reference/backend/environment/http',
                            },
                        ],
                    },
                ],
                footer: {
                    message:
                        'Released under the <a href="https://github.com/gdmuna/TalosArk/blob/dev/LICENSE">AGPL-3.0 License</a>',
                    copyright:
                        'Copyright © 2024-present <a href="https://github.com/gdmuna">GDMU-NA & GDMU-ACM</a>',
                },
                editLink: {
                    pattern:
                        'https://github.com/gdmuna/TalosArk/edit/dev/packages/docsite/docs/:path',
                    text: 'Edit this page on GitHub',
                },
                lastUpdated: { text: 'Last updated' },
                outline: { label: 'On this page' },
                docFooter: { prev: 'Previous page', next: 'Next page' },
                darkModeSwitchLabel: 'Appearance',
                lightModeSwitchTitle: 'Switch to light theme',
                darkModeSwitchTitle: 'Switch to dark theme',
                sidebarMenuLabel: 'Menu',
                returnToTopLabel: 'Return to top',
                langMenuLabel: 'Change language',
            },
        },
    },
});
