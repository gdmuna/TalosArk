import type { WorkspaceSnapshot } from '@/shared/models/workspace';
import type { Approval, ExceptionItem, WorkbenchSnapshot } from '@/shared/models/workbench';
import type { AccountProfile } from '@/shared/models/account';

export interface AccountDataSource {
    load(): Promise<AccountProfile>;
    updateDisplayName(name: string): Promise<void>;
}

export interface WorkspaceDataSource {
    load(): Promise<WorkspaceSnapshot>;
    create(name: string, organizationId: string): Promise<string>;
    join(code: string): Promise<string>;
}

export interface WorkbenchDataSource {
    load(): Promise<WorkbenchSnapshot>;
    completeTasks(ids: string[]): Promise<void>;
    decideApprovals(
        ids: string[],
        status: Extract<Approval['status'], '已批准' | '已退回'>,
        note: string
    ): Promise<void>;
    updateExceptions(
        ids: string[],
        status: Extract<ExceptionItem['status'], '已处理' | '已忽略'>
    ): Promise<void>;
    addInspection(resourceId: string): Promise<string>;
}
