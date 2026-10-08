import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { workbenchRoutes } from '@/module/workbench/route';
import { managementPath, managementRoutes } from './management';
import { materialRoutes, inventoryRoutes, equipmentRoutes } from './resource';

declare module 'vue-router' {
    interface RouteMeta {
        /** 浏览器标签页标题 */
        defaultTitle?: string;
        pageLabel?: string;
        sectionLabel?: string;
        sectionPath?: string;
        resourceDetail?: boolean;
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
                component: () => import('@/page/auth/Auth.vue'),
                meta: {
                    defaultTitle: 'login',
                },
            },
            {
                path: 'callback',
                component: () => import('@/page/auth/Auth-Callback.vue'),
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
                path: 'management',
                component: () => import('@/page/management/Management.vue'),
                redirect: `${managementPath}/overview`,
                meta: { sectionLabel: '管理中心', sectionPath: managementPath },
                children: managementRoutes,
            },
            {
                path: 'workbench',
                component: () => import('@/page/workbench/Workbench.vue'),
                redirect: '/main/workbench/overview',
                meta: {
                    defaultTitle: 'workbench',
                },
                children: workbenchRoutes,
            },
            {
                path: 'material',
                component: () => import('@/page/material/Material.vue'),
                redirect: '/main/material/overview',
                meta: {
                    defaultTitle: 'material',
                    sectionLabel: '材料',
                    sectionPath: '/main/material/overview',
                },
                children: materialRoutes,
            },
            {
                path: 'inventory',
                component: () => import('@/page/inventory/Inventory.vue'),
                redirect: '/main/inventory/overview',
                meta: {
                    defaultTitle: 'inventory',
                    sectionLabel: '库存',
                    sectionPath: '/main/inventory/overview',
                },
                children: inventoryRoutes,
            },
            {
                path: 'equipment',
                component: () => import('@/page/equipment/Equipment.vue'),
                redirect: '/main/equipment/overview',
                meta: {
                    defaultTitle: 'equipment',
                    sectionLabel: '设备',
                    sectionPath: '/main/equipment/overview',
                },
                children: equipmentRoutes,
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
