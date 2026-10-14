import type { INestApplicationContext } from '@nestjs/common';
import { AuthorizationRegistry } from '@/core/permission/authorization.registry.js';
import {
    organizationAuthorizationEntries,
    organizationPermission,
} from '@/modules/organization/contribution/organization-authorization.contribution.js';
import { workspacePermission } from '@/modules/workspace/contribution/workspace-authorization.contribution.js';

export function initializeExtensions(app: INestApplicationContext): void {
    app.get(AuthorizationRegistry).initialize({
        explicit: organizationAuthorizationEntries,
        discovery: true,
        required: [
            { code: organizationPermission.read, scope: 'ORGANIZATION' },
            { code: workspacePermission.create, scope: 'ORGANIZATION' },
            { code: workspacePermission.read, scope: 'WORKSPACE' },
        ],
    });
}
