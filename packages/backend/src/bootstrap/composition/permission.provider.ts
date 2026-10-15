import { PermissionConfigurationModule } from '@/core/permission/index.js';
import {
    organizationAuthorizationEntries,
    organizationPermission,
} from '@/modules/organization/contribution/organization-authorization.contribution.js';
import { workspacePermission } from '@/modules/workspace/contribution/workspace-authorization.contribution.js';

export const permissionConfiguration = PermissionConfigurationModule.forRoot({
    explicit: organizationAuthorizationEntries,
    discovery: true,
    required: [
        { code: organizationPermission.read, scope: 'ORGANIZATION' },
        { code: workspacePermission.create, scope: 'ORGANIZATION' },
        { code: workspacePermission.read, scope: 'WORKSPACE' },
    ],
});
