import type { TeamDataSource } from '../team-source';
import type {
    DetailCatalog,
    WorkspaceDetail,
    MemberDetail,
    RoleDetail,
} from '../../model/management-detail';

export class ManagementDetailUnavailableError extends Error {}

// Frontend read-model proposal, not a published HTTP contract.
export interface ManagementDetailSource {
    catalog(signal?: AbortSignal): Promise<DetailCatalog>;
    workspace(id: string, signal?: AbortSignal): Promise<WorkspaceDetail>;
    member(organizationId: string, memberId: string, signal?: AbortSignal): Promise<MemberDetail>;
    role(organizationId: string, roleId: string, signal?: AbortSignal): Promise<RoleDetail>;
    updateWorkspace(
        id: string,
        patch: { name: string; description: string },
        signal?: AbortSignal
    ): Promise<void>;
    team: TeamDataSource;
}
