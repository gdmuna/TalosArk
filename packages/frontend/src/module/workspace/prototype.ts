// Explicit R03 prototype entry. Never selected by application bootstrap.
export { createManagementDetailMock } from './data/detail/mock';
export { createTeamManagementState } from './model/team-store';
export type { ManagementDetailSource } from './data/detail/source';
export { ManagementDetailUnavailableError } from './data/detail/source';
export type { TeamManagementContext } from './ui/team-context';
export type {
    WorkspaceDetail,
    MemberDetail,
    RoleDetail,
    DetailCatalog,
    DetailActivity,
    DetailResource,
    DetailFacilityAccess,
} from './model/management-detail';
