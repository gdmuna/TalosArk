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
    UserRound,
    Warehouse,
} from '@lucide/vue';
import AccountSetting from '@/page/management/AccountSetting.vue';
import Overview from '@/page/management/Overview.vue';
import OrganizationSetting from '@/page/management/OrganizationSetting.vue';
import Workspace from '@/page/management/Workspace.vue';
import Member from '@/page/management/Member.vue';
import Role from '@/page/management/Role.vue';
import ResourceGrant from '@/page/management/ResourceGrant.vue';
import SharingPolicy from '@/page/management/SharingPolicy.vue';
import Facility from '@/page/management/Facility.vue';
import StorageGovernance from '@/page/management/StorageGovernance.vue';
import DeviceAccess from '@/page/management/DeviceAccess.vue';
import DeviceIntegration from '@/page/management/DeviceIntegration.vue';
import AuditLog from '@/page/management/AuditLog.vue';
import NotificationPolicy from '@/page/management/NotificationPolicy.vue';
import Integration from '@/page/management/Integration.vue';
import SystemSetting from '@/page/management/SystemSetting.vue';

export const managementPath = '/main/management';

export const managementNavigation = [
    {
        label: '',
        items: [
            {
                label: '账户设置',
                icon: UserRound,
                path: 'account-setting',
                component: AccountSetting,
            },
        ],
    },
    {
        label: '组织',
        items: [
            {
                label: '概览',
                icon: LayoutDashboard,
                path: 'overview',
                component: Overview,
            },
            {
                label: '组织设置',
                icon: Building2,
                path: 'organization-setting',
                component: OrganizationSetting,
            },
            {
                label: '工作区',
                icon: Folders,
                path: 'workspace',
                component: Workspace,
            },
            {
                label: '成员',
                icon: UsersRound,
                path: 'member',
                component: Member,
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
                component: Role,
            },
            {
                label: '资源授权',
                icon: KeyRound,
                path: 'resource-grant',
                component: ResourceGrant,
            },
            {
                label: '共享策略',
                icon: Share2,
                path: 'sharing-policy',
                component: SharingPolicy,
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
                component: Facility,
            },
            {
                label: '存储设施治理',
                icon: Warehouse,
                path: 'storage-governance',
                component: StorageGovernance,
            },
            {
                label: '设备接入',
                icon: Cable,
                path: 'device-access',
                component: DeviceAccess,
            },
            {
                label: '设备集成',
                icon: Network,
                path: 'device-integration',
                component: DeviceIntegration,
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
                component: AuditLog,
            },
            {
                label: '通知策略',
                icon: Bell,
                path: 'notification-policy',
                component: NotificationPolicy,
            },
            {
                label: '集成',
                icon: FolderCog,
                path: 'integration',
                component: Integration,
            },
            {
                label: '系统设置',
                icon: Settings,
                path: 'system-setting',
                component: SystemSetting,
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
