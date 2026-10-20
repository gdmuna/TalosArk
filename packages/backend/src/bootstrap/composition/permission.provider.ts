import { PermissionConfigurationModule } from '@/core/permission/index.js';
import {
    organizationAuthorizationEntries,
    organizationPermission,
    workspacePermission,
} from '@/core/team-governance/index.js';
import { materialPermission } from '@/modules/material/contribution/material-authorization.contribution.js';
import { facilityAuthorization } from '@/modules/facility/contribution/facility-authorization.contribution.js';
import { inventoryAuthorization } from '@/modules/inventory/contribution/inventory-authorization.contribution.js';
import { approvalAuthorization } from '@/modules/approval/contribution/approval-authorization.contribution.js';

export const permissionConfiguration = PermissionConfigurationModule.forRoot({
    explicit: organizationAuthorizationEntries,
    discovery: true,
    required: [
        { code: organizationPermission.read, scope: 'ORGANIZATION' },
        { code: workspacePermission.create, scope: 'ORGANIZATION' },
        { code: workspacePermission.read, scope: 'WORKSPACE' },
        ...Object.values(materialPermission).map((code) => ({ code, scope: 'WORKSPACE' as const })),
        ...facilityAuthorization.definitions.map(({ code, scope }) => ({ code, scope })),
        ...inventoryAuthorization.definitions.map(({ code, scope }) => ({ code, scope })),
        ...approvalAuthorization.definitions.map(({ code, scope }) => ({ code, scope })),
    ],
});
