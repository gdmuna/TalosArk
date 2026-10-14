import type { RouteRecordRaw } from 'vue-router';
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

import { managementNavigation } from './management-navigation';

const pages = {
    'account-setting': AccountSetting,
    overview: Overview,
    'organization-setting': OrganizationSetting,
    workspace: Workspace,
    member: Member,
    role: Role,
    'resource-grant': ResourceGrant,
    'sharing-policy': SharingPolicy,
    facility: Facility,
    'storage-governance': StorageGovernance,
    'device-access': DeviceAccess,
    'device-integration': DeviceIntegration,
    'audit-log': AuditLog,
    'notification-policy': NotificationPolicy,
    integration: Integration,
    'system-setting': SystemSetting,
};

export const managementRoutes: RouteRecordRaw[] = managementNavigation.flatMap((group) =>
    group.items.map(({ path, label }) => ({
        path,
        component: pages[path],
        meta: {
            defaultTitle: label,
            pageLabel: label,
            ...(path === 'account-setting' ? { requiresWorkspace: false } : {}),
        },
    }))
);
