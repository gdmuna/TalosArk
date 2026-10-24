import type { AuthorizationDefinition } from '@/core/permission/authorization-definition.js';
import type { ExtensionEntry } from '@/platform/extensions/index.js';
import {
    organizationAuthorizationEntries,
    workspaceAuthorization,
    workspacePermission,
} from '@/core/team-governance/team-governance.permission.js';
import {
    materialAuthorization,
    materialPermission,
} from '@/modules/material/contribution/material-authorization.contribution.js';
import {
    inventoryAuthorization,
    inventoryPermission,
} from '@/modules/inventory/contribution/inventory-authorization.contribution.js';
import {
    approvalAuthorization,
    approvalPermission,
} from '@/modules/approval/contribution/approval-authorization.contribution.js';
import {
    facilityAuthorization,
    facilityPermission,
} from '@/modules/facility/contribution/facility-authorization.contribution.js';

export const workspaceManagerPermissions = Object.freeze([
    workspacePermission.read,
    workspacePermission.members,
    workspacePermission.update,
    workspacePermission.audit,
    ...Object.values(materialPermission),
    ...Object.values(inventoryPermission),
    ...Object.values(approvalPermission),
    facilityPermission.read,
    facilityPermission.use,
    facilityPermission.manage,
]);

/** The product's declaration catalog is independent of which seed handlers run. */
export const productAuthorizationEntries: readonly ExtensionEntry<
    string,
    AuthorizationDefinition
>[] = Object.freeze([
    ...organizationAuthorizationEntries,
    ...[
        workspaceAuthorization,
        materialAuthorization,
        inventoryAuthorization,
        approvalAuthorization,
        facilityAuthorization,
    ].flatMap((metadata) =>
        metadata.definitions.map((value) => ({
            key: value.code,
            value,
            source: { kind: 'explicit' as const, owner: metadata.namespace },
        }))
    ),
]);
