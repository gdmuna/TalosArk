import {
    CreateOrganizationResponseSchema,
    TeamSnapshotResponseSchema,
    WorkspaceSummarySchema,
} from '@talos-ark/contracts/team';
import { HttpError, type HttpClient } from '@/platform/http';
import type { WorkspaceDataSource } from './source';

export function createHttpWorkspaceDataSource(http: HttpClient): WorkspaceDataSource {
    return {
        async load(signal) {
            const snapshot = await http.request({
                method: 'GET',
                path: '/organization/context',
                schema: TeamSnapshotResponseSchema,
                signal,
                retry: false,
            });
            return { ...snapshot, activeId: snapshot.workspaces[0]?.id ?? '' };
        },
        async create(name, organizationId, signal) {
            const workspace = await http.request({
                method: 'POST',
                path: `/organization/${encodeURIComponent(organizationId)}/workspace`,
                body: { name },
                schema: WorkspaceSummarySchema,
                signal,
                retry: false,
            });
            return workspace.id;
        },
        async createOrganization(name, workspaceName, signal) {
            const result = await http.request({
                method: 'POST',
                path: '/organization',
                body: { name, workspaceName },
                schema: CreateOrganizationResponseSchema,
                signal,
                retry: false,
            });
            return result.workspace.id;
        },
        async select(workspace, signal) {
            const context = await http.request({
                method: 'GET',
                path: `/organization/${encodeURIComponent(workspace.organizationId)}/workspace/${encodeURIComponent(workspace.id)}/context`,
                schema: WorkspaceSummarySchema,
                signal,
                retry: false,
            });
            if (context.id !== workspace.id || context.organizationId !== workspace.organizationId)
                throw new HttpError('工作区上下文与所选记录不一致', 'protocol');
        },
    };
}
