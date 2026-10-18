export { TeamGovernanceKernel } from './team-governance.kernel.js';
export { TeamGovernanceModule } from './team-governance.module.js';
export { TeamGovernanceError } from './team-governance.error.js';
export type {
    OrganizationGovernanceInput,
    TeamGovernanceInput,
    WorkspaceGovernanceInput,
    TeamGovernanceSnapshot,
    WorkspaceGovernanceSnapshot,
    TeamMemberVisibility,
} from './team-governance.contract.js';
export {
    organizationPermission,
    organizationReadAuthorization,
    organizationAuthorizationEntries,
    workspacePermission,
    workspaceCreateAuthorization,
    workspaceReadAuthorization,
    workspaceAuthorization,
    type OrganizationGovernancePermission,
} from './team-governance.permission.js';
