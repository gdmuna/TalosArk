import type { ApprovalLine, ApprovalRequest } from '@talos-ark/contracts/approval';
export function approvalStockLabel(stock: ApprovalLine['stock']) {
    return stock ? (stock.code ?? stock.materialName) : '资源受限';
}
export const approvalTypeLabel = { CONSUME: '消耗申请', TRANSFER: '转移申请' } as const;
export const decisionLabel = {
    UNDECIDED: '待审批',
    APPROVED: '已批准',
    REJECTED: '已拒绝',
} as const;
export const executionLabel = {
    PENDING: '待执行',
    EXECUTED: '已执行',
    ABANDONED: '已放弃',
    REVOKED: '已撤销',
} as const;
export function approvalStatusLabel(row: ApprovalRequest) {
    if (row.status === 'PENDING') return '待审批';
    if (row.status === 'WITHDRAWN') return '已撤回';
    if (!row.decisions.approved) return '全部拒绝';
    return row.decisions.rejected ? '部分批准' : '全部批准';
}
export const blockedLabel: Record<string, string> = {
    resourceRestricted: '资源信息受限',
    permission: '当前执行资格或设施权限不足',
    binding: '位置或治理设施已改变',
    insufficient: '当前余量不足',
    consumptionExpired: '实物已过期',
    state: '实物或存储状态暂不可用',
    occupied: '目标位置已被占用',
    invalid: '数量或实物资料需要核对',
};
