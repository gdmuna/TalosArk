import type {
    WorkspaceDetail,
    WorkspaceUpdate,
    MemberDetail,
    RoleDetail,
    ManagementPageQuery,
    ManagementRoleQuery,
    ManagementActivityQuery,
    ManagementMemberPage,
    ManagementRolePage,
    MemberWorkspacePage,
    RoleBindingPage,
    ManagementActivityPage,
} from '@talos-ark/contracts/team';
import type { TeamDataSource, TeamSelection } from './team-source';

type WorkspaceSelection = TeamSelection & { workspaceId: string };
type PageQuery = Omit<ManagementPageQuery, 'workspaceId'>;

export interface ManagementDataSource {
    team: TeamDataSource;
    workspace(selection: WorkspaceSelection, signal?: AbortSignal): Promise<WorkspaceDetail>;
    updateWorkspace(
        selection: WorkspaceSelection,
        body: WorkspaceUpdate,
        signal?: AbortSignal
    ): Promise<void>;
    member(selection: TeamSelection, id: string, signal?: AbortSignal): Promise<MemberDetail>;
    role(selection: TeamSelection, id: string, signal?: AbortSignal): Promise<RoleDetail>;
    members(
        selection: TeamSelection,
        query: PageQuery,
        signal?: AbortSignal
    ): Promise<ManagementMemberPage>;
    roles(
        selection: TeamSelection,
        query: Omit<ManagementRoleQuery, 'workspaceId'>,
        signal?: AbortSignal
    ): Promise<ManagementRolePage>;
    memberWorkspaces(
        selection: TeamSelection,
        id: string,
        query: PageQuery,
        signal?: AbortSignal
    ): Promise<MemberWorkspacePage>;
    bindings(
        selection: TeamSelection,
        id: string,
        query: PageQuery,
        signal?: AbortSignal
    ): Promise<RoleBindingPage>;
    activity(
        selection: TeamSelection,
        kind: 'workspace' | 'member' | 'role',
        id: string,
        query: Omit<ManagementActivityQuery, 'workspaceId'>,
        signal?: AbortSignal
    ): Promise<ManagementActivityPage>;
}
