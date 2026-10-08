import type { RouteRecordRaw } from 'vue-router';
import {
    Bell,
    Building2,
    Cable,
    ClipboardList,
    DoorOpen,
    FolderCog,
    Folders,
    KeyRound,
    LayoutDashboard,
    Network,
    Settings,
    Share2,
    ShieldCheck,
    UsersRound,
    Warehouse,
} from '@lucide/vue';

export const managementPath = '/main/management';

export const managementNavigation = [
    {
        label: '组织',
        items: [
            {
                label: '概览',
                icon: LayoutDashboard,
                path: 'overview',
                component: () => import('@/page/management/Overview.vue'),
            },
            {
                label: '组织设置',
                icon: Building2,
                path: 'organization-setting',
                component: () => import('@/page/management/OrganizationSetting.vue'),
            },
            {
                label: '工作区',
                icon: Folders,
                path: 'workspace',
                component: () => import('@/page/management/Workspace.vue'),
            },
            {
                label: '成员',
                icon: UsersRound,
                path: 'member',
                component: () => import('@/page/management/Member.vue'),
            },
        ],
    },
    {
        label: '权限与共享',
        items: [
            {
                label: '角色与权限',
                icon: ShieldCheck,
                path: 'role',
                component: () => import('@/page/management/Role.vue'),
            },
            {
                label: '资源授权',
                icon: KeyRound,
                path: 'resource-grant',
                component: () => import('@/page/management/ResourceGrant.vue'),
            },
            {
                label: '共享策略',
                icon: Share2,
                path: 'sharing-policy',
                component: () => import('@/page/management/SharingPolicy.vue'),
            },
        ],
    },
    {
        label: '设施与设备',
        items: [
            {
                label: '设施',
                icon: DoorOpen,
                path: 'facility',
                component: () => import('@/page/management/Facility.vue'),
            },
            {
                label: '存储设施治理',
                icon: Warehouse,
                path: 'storage-governance',
                component: () => import('@/page/management/StorageGovernance.vue'),
            },
            {
                label: '设备接入',
                icon: Cable,
                path: 'device-access',
                component: () => import('@/page/management/DeviceAccess.vue'),
            },
            {
                label: '设备集成',
                icon: Network,
                path: 'device-integration',
                component: () => import('@/page/management/DeviceIntegration.vue'),
            },
        ],
    },
    {
        label: '系统',
        items: [
            {
                label: '审计日志',
                icon: ClipboardList,
                path: 'audit-log',
                component: () => import('@/page/management/AuditLog.vue'),
            },
            {
                label: '通知策略',
                icon: Bell,
                path: 'notification-policy',
                component: () => import('@/page/management/NotificationPolicy.vue'),
            },
            {
                label: '集成',
                icon: FolderCog,
                path: 'integration',
                component: () => import('@/page/management/Integration.vue'),
            },
            {
                label: '系统设置',
                icon: Settings,
                path: 'system-setting',
                component: () => import('@/page/management/SystemSetting.vue'),
            },
        ],
    },
];

export const managementRoutes: RouteRecordRaw[] = managementNavigation.flatMap((group) =>
    group.items.map(({ path, label, component }) => ({
        path,
        component,
        meta: { defaultTitle: label, pageLabel: label },
    }))
);
