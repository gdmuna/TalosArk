import type { Approval, ExceptionItem, WorkbenchSnapshot } from '../model/workbench';

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
