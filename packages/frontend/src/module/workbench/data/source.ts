import type { Approval, ExceptionItem, WorkbenchSnapshot } from '../model/workbench';
import type { MaterialOverview, MaterialScope } from '@talos-ark/contracts/material';
import type { StockPageSchema } from '@talos-ark/contracts/inventory';
import type { FacilityPageSchema } from '@talos-ark/contracts/facility';
import type { z } from 'zod';
import type { ApprovalSummary, ApprovalRequestPage } from '@talos-ark/contracts/approval';

export interface WorkbenchOverviewDataSource {
    approvalSummary?(scope: MaterialScope, signal: AbortSignal): Promise<ApprovalSummary>;
    approvalRequests?(scope: MaterialScope, signal: AbortSignal): Promise<ApprovalRequestPage>;
    material?(scope: MaterialScope, signal: AbortSignal): Promise<MaterialOverview>;
    inventory?(scope: MaterialScope, signal: AbortSignal): Promise<z.infer<typeof StockPageSchema>>;
    facilities?(
        scope: MaterialScope,
        signal: AbortSignal
    ): Promise<z.infer<typeof FacilityPageSchema>>;
}

export interface WorkbenchDataSource {
    load(signal?: AbortSignal): Promise<WorkbenchSnapshot>;
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
