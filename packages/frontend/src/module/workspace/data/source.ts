import type { WorkspaceSnapshot } from '../model/workspace';

export interface WorkspaceDataSource {
    load(signal?: AbortSignal): Promise<WorkspaceSnapshot>;
    create(name: string, organizationId: string): Promise<string>;
    join(code: string): Promise<string>;
}
