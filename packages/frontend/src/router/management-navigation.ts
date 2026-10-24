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
export const managementPath = '/main/management';

export const managementNavigation = [
    {
        label: '',
        items: [
            {
                label: '账户设置',
                icon: UserRound,
                path: 'account-setting',
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
            },
            {
                label: '组织设置',
                icon: Building2,
                path: 'organization-setting',
            },
            {
                label: '工作区',
                icon: Folders,
                path: 'workspace',
            },
            {
                label: '成员',
                icon: UsersRound,
                path: 'member',
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
            },
            {
                label: '资源授权',
                icon: KeyRound,
                path: 'resource-grant',
            },
            {
                label: '共享策略',
                icon: Share2,
                path: 'sharing-policy',
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
            },
            {
                label: '存储设施治理',
                icon: Warehouse,
                path: 'storage-governance',
            },
            {
                label: '设备接入',
                icon: Cable,
                path: 'device-access',
            },
            {
                label: '设备集成',
                icon: Network,
                path: 'device-integration',
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
            },
            {
                label: '通知策略',
                icon: Bell,
                path: 'notification-policy',
            },
            {
                label: '集成',
                icon: FolderCog,
                path: 'integration',
            },
            {
                label: '系统设置',
                icon: Settings,
                path: 'system-setting',
            },
        ],
    },
] as const;
