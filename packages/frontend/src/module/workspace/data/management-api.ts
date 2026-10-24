import {
    WorkspaceDetailSchema,
    MemberDetailSchema,
    RoleDetailSchema,
    ManagementMemberPageSchema,
    ManagementRolePageSchema,
    MemberWorkspacePageSchema,
    RoleBindingPageSchema,
    ManagementActivityPageSchema,
    type ManagementPageQuery,
    type ManagementRoleQuery,
    type ManagementActivityQuery,
    type WorkspaceUpdate,
} from '@talos-ark/contracts/team';
import type { HttpClient } from '@/platform/http';
import type { TeamDataSource, TeamSelection } from './team-source';
import type { ManagementDataSource } from './management-source';

export function createHttpManagementDataSource(
    http: HttpClient,
    team: TeamDataSource
): ManagementDataSource {
    const root = (organizationId: string) => `/organization/${encodeURIComponent(organizationId)}`;
    const workspaceRoot = (selection: TeamSelection & { workspaceId: string }) =>
        `${root(selection.organizationId)}/workspace/${encodeURIComponent(selection.workspaceId)}`;
    const itemRoot = (selection: TeamSelection, kind: 'member' | 'role', id: string) =>
        `${root(selection.organizationId)}/team/${kind}/${encodeURIComponent(id)}`;
    return {
        team,
        workspace: (selection: TeamSelection & { workspaceId: string }, signal?: AbortSignal) =>
            http.request({
                method: 'GET',
                path: workspaceRoot(selection),
                schema: WorkspaceDetailSchema,
                signal,
                retry: false,
            }),
        updateWorkspace: async (
            selection: TeamSelection & { workspaceId: string },
            body: WorkspaceUpdate,
            signal?: AbortSignal
        ) => {
            await http.request({
                method: 'PATCH',
                path: workspaceRoot(selection),
                body,
                response: 'empty',
                signal,
                retry: false,
            });
        },
        member: (selection: TeamSelection, id: string, signal?: AbortSignal) =>
            http.request({
                method: 'GET',
                path: itemRoot(selection, 'member', id),
                params: { workspaceId: selection.workspaceId },
                schema: MemberDetailSchema,
                signal,
                retry: false,
            }),
        role: (selection: TeamSelection, id: string, signal?: AbortSignal) =>
            http.request({
                method: 'GET',
                path: itemRoot(selection, 'role', id),
                params: { workspaceId: selection.workspaceId },
                schema: RoleDetailSchema,
                signal,
                retry: false,
            }),
        members: (
            selection: TeamSelection,
            query: Omit<ManagementPageQuery, 'workspaceId'>,
            signal?: AbortSignal
        ) =>
            http.request({
                method: 'GET',
                path: `${root(selection.organizationId)}/team/member`,
                params: { ...query, workspaceId: selection.workspaceId },
                schema: ManagementMemberPageSchema,
                signal,
                retry: false,
            }),
        roles: (
            selection: TeamSelection,
            query: Omit<ManagementRoleQuery, 'workspaceId'>,
            signal?: AbortSignal
        ) =>
            http.request({
                method: 'GET',
                path: `${root(selection.organizationId)}/team/role`,
                params: { ...query, workspaceId: selection.workspaceId },
                schema: ManagementRolePageSchema,
                signal,
                retry: false,
            }),
        memberWorkspaces: (
            selection: TeamSelection,
            id: string,
            query: Omit<ManagementPageQuery, 'workspaceId'>,
            signal?: AbortSignal
        ) =>
            http.request({
                method: 'GET',
                path: `${itemRoot(selection, 'member', id)}/workspace`,
                params: { ...query, workspaceId: selection.workspaceId },
                schema: MemberWorkspacePageSchema,
                signal,
                retry: false,
            }),
        bindings: (
            selection: TeamSelection,
            id: string,
            query: Omit<ManagementPageQuery, 'workspaceId'>,
            signal?: AbortSignal
        ) =>
            http.request({
                method: 'GET',
                path: `${itemRoot(selection, 'role', id)}/member`,
                params: { ...query, workspaceId: selection.workspaceId },
                schema: RoleBindingPageSchema,
                signal,
                retry: false,
            }),
        activity: (
            selection: TeamSelection,
            kind: 'workspace' | 'member' | 'role',
            id: string,
            query: Omit<ManagementActivityQuery, 'workspaceId'>,
            signal?: AbortSignal
        ) =>
            http.request({
                method: 'GET',
                path:
                    kind === 'workspace'
                        ? `${workspaceRoot({ ...selection, workspaceId: id })}/activity`
                        : `${itemRoot(selection, kind, id)}/activity`,
                params: { ...query, workspaceId: selection.workspaceId },
                schema: ManagementActivityPageSchema,
                signal,
                retry: false,
            }),
    };
}
