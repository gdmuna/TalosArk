import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { workbenchRoutes } from '@/module/workbench/route';
import { managementRoutes } from './management';
import { managementPath } from './management-navigation';
import { workbenchPath, workbenchPage } from '@/module/workbench/navigation';
import { materialRoutes, inventoryRoutes, equipmentRoutes } from './resource';
import DesktopAuthShell from '@/layout/shell/DesktopAuthShell.vue';
import DesktopPrimarySidebarShell from '@/layout/shell/DesktopPrimarySidebarShell.vue';
import Auth from '@/page/auth/Auth.vue';
import AuthCallback from '@/page/auth/Auth-Callback.vue';
import AuthRecovery from '@/page/auth/Auth-Recovery.vue';
import AuthResetPassword from '@/page/auth/Auth-ResetPassword.vue';
import Management from '@/page/management/Management.vue';
import Workbench from '@/page/workbench/Workbench.vue';
import Material from '@/page/material/Material.vue';
import Inventory from '@/page/inventory/Inventory.vue';
import Equipment from '@/page/equipment/Equipment.vue';

declare module 'vue-router' {
    interface RouteMeta {
        /** 浏览器标签页标题 */
        defaultTitle?: string;
        pageLabel?: string;
        sectionLabel?: string;
        sectionPath?: string;
        resourceDetail?: boolean;
        /** Public forms may use the available width instead of the desktop minimum. */
        fluidLayout?: boolean;
    }
}

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/main',
    },
    {
        path: '/auth',
        component: DesktopAuthShell,
        redirect: '/auth/login',
        meta: { fluidLayout: true },
        children: [
            {
                path: 'login',
                component: Auth,
                meta: {
                    defaultTitle: 'login',
                },
            },
            {
                path: 'callback',
                component: AuthCallback,
                meta: {
                    defaultTitle: 'callback',
                },
            },
            {
                path: 'recovery',
                component: AuthRecovery,
                meta: { defaultTitle: '找回密码' },
            },
            {
                path: 'reset-password',
                component: AuthResetPassword,
                meta: { defaultTitle: '重设密码' },
            },
        ],
    },
    {
        path: '/main',
        component: DesktopPrimarySidebarShell,
        children: [
            {
                path: '',
                redirect: workbenchPath,
            },
            {
                path: 'management',
                component: Management,
                redirect: '/main/management/account-setting',
                meta: { sectionLabel: '管理中心', sectionPath: managementPath },
                children: managementRoutes,
            },
            {
                path: 'workbench',
                component: Workbench,
                redirect: workbenchPage.overview.path,
                meta: {
                    defaultTitle: 'workbench',
                },
                children: workbenchRoutes,
            },
            {
                path: 'material',
                component: Material,
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
                component: Inventory,
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
                component: Equipment,
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
