import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

declare module 'vue-router' {
    interface RouteMeta {
        /** 浏览器标签页标题 */
        defaultTitle?: string;
    }
}

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/main',
    },
    {
        path: '/auth',
        component: () => import('@/layout/shell/DesktopAuthShell.vue'),
        redirect: '/auth/login',
        children: [
            {
                path: 'login',
                component: () => import('@/pages/auth/Auth.vue'),
                meta: {
                    defaultTitle: 'login',
                },
            },
            {
                path: 'callback',
                component: () => import('@/pages/auth/Auth-Callback.vue'),
                meta: {
                    defaultTitle: 'callback',
                },
            },
        ],
    },
    {
        path: '/main',
        component: () => import('@/layout/shell/DesktopPrimarySidebarShell.vue'),
        children: [
            {
                path: '',
                redirect: '/main/workbench',
            },
            {
                path: 'workbench',
                component: () => import('@/pages/workbench/Workbench.vue'),
                redirect: '/main/workbench/overview',
                meta: {
                    defaultTitle: 'workbench',
                },
                children: [
                    {
                        path: 'overview',
                        component: () => import('@/pages/workbench/Overview.vue'),
                        meta: {
                            defaultTitle: 'overview',
                        },
                    },
                    {
                        path: 'my-task',
                        component: () => import('@/pages/workbench/MyTask.vue'),
                        meta: {
                            defaultTitle: 'my-task',
                        },
                    },
                    {
                        path: 'pending-approval',
                        component: () => import('@/pages/workbench/PendingApproval.vue'),
                        meta: {
                            defaultTitle: 'pending-approval',
                        },
                    },
                    {
                        path: 'exception-alert',
                        component: () => import('@/pages/workbench/ExceptionAlert.vue'),
                        meta: {
                            defaultTitle: 'exception-alert',
                        },
                    },
                ],
            },
            {
                path: 'material',
                component: () => import('@/pages/material/Material.vue'),
                redirect: '/main/material/overview',
                meta: {
                    defaultTitle: 'material',
                },
                children: [
                    {
                        path: 'overview',
                        component: () => import('@/pages/material/Overview.vue'),
                        meta: {
                            defaultTitle: 'overview',
                        },
                    },
                    {
                        path: 'list',
                        component: () => import('@/pages/material/List.vue'),
                        meta: {
                            defaultTitle: 'list',
                        },
                    },
                    {
                        path: 'culture',
                        component: () => import('@/pages/material/Culture.vue'),
                        meta: {
                            defaultTitle: 'culture',
                        },
                    },
                ],
            },
            {
                path: 'inventory',
                component: () => import('@/pages/inventory/Inventory.vue'),
                redirect: '/main/inventory/overview',
                meta: {
                    defaultTitle: 'inventory',
                },
                children: [
                    {
                        path: 'overview',
                        component: () => import('@/pages/inventory/Overview.vue'),
                        meta: {
                            defaultTitle: 'overview',
                        },
                    },
                    {
                        path: 'ledger',
                        component: () => import('@/pages/inventory/Ledger.vue'),
                        meta: {
                            defaultTitle: 'overview',
                        },
                    },
                    {
                        path: 'storage-topology',
                        component: () => import('@/pages/inventory/StorageTopology.vue'),
                        meta: {
                            defaultTitle: 'overview',
                        },
                    },
                    {
                        path: 'stocktake',
                        component: () => import('@/pages/inventory/Stocktake.vue'),
                        meta: {
                            defaultTitle: 'overview',
                        },
                    },
                ],
            },
            {
                path: 'equipment',
                component: () => import('@/pages/equipment/Equipment.vue'),
                redirect: '/main/equipment/overview',
                meta: {
                    defaultTitle: 'equipment',
                },
                children: [
                    {
                        path: 'overview',
                        component: () => import('@/pages/equipment/Overview.vue'),
                        meta: {
                            defaultTitle: 'overview',
                        },
                    },
                    {
                        path: 'list',
                        component: () => import('@/pages/equipment/List.vue'),
                        meta: {
                            defaultTitle: 'list',
                        },
                    },
                ],
            },
        ],
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

// router.beforeEach(async (to) => {
//     const auth = useAuthStore();
//     if (!auth.initialized) await auth.fetchMe();
//     if (!to.meta.public && !auth.isLoggedIn) return '/login';
// });

// 同步浏览器标签页标题
// router.afterEach((to) => {
//     document.title = to.meta.webTitle ?? 'Playground';
// });

export default router;
