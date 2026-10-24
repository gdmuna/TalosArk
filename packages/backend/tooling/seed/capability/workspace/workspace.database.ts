import { databaseTables } from '../../definition/database.js';

/** Shared scope, authorization and audit facts used by workspace-scoped commands. */
export const workspaceDatabase = databaseTables(
    'User',
    'Organization',
    'OrganizationMember',
    'Workspace',
    'WorkspaceMember',
    'Role',
    'RolePermission',
    'OrganizationRoleBinding',
    'WorkspaceRoleBinding',
    'AuditEvent'
);
