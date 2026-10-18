import type { Workspace, WorkspaceSnapshot } from '../model/workspace';
export type { TeamDataSource, TeamCommand, TeamSelection } from './team-source';
export type { ManagementDataSource } from './management-source';

export interface WorkspaceDataSource {
    load(signal?: AbortSignal): Promise<WorkspaceSnapshot>;
    create(name: string, organizationId: string, signal?: AbortSignal): Promise<string>;
    createOrganization?(name: string, workspaceName: string, signal?: AbortSignal): Promise<string>;
    select?(workspace: Workspace, signal?: AbortSignal): Promise<void>;
    join?(code: string, signal?: AbortSignal): Promise<string>;
}
