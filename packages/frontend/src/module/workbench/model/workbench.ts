import type { StateTone } from '@/component/state-badge';

export type Resource = {
    id: string;
    name: string;
    kind: '材料定义' | '库存实例' | '设施' | '设备' | '文件';
    materialId?: string;
    workspaceId: string;
    description: string;
    status: string;
};
export type Task = {
    id: string;
    title: string;
    subtitle: string;
    kind: '审批' | '任务';
    approvalId?: string;
    resourceId: string;
    workspaceId: string;
    applicant: string;
    createdAt: number;
    dueAt: number;
    status: '待处理' | '已完成';
};
export const isTaskOverdue = (task: Task) => task.status === '待处理' && task.dueAt < Date.now();
export const taskDisplayStatus = (task: Task) => (isTaskOverdue(task) ? '已逾期' : task.status);
export type Approval = {
    id: string;
    kind: '领用申请' | '库存转移' | '设备操作' | '检测结果审核';
    applicant: string;
    resourceId: string;
    workspaceId: string;
    quantity: number;
    unit: string;
    available: number;
    createdAt: number;
    status: '待审批' | '已批准' | '已退回';
    note: string;
    reviewNote?: string;
};
export type ExceptionItem = {
    id: string;
    title: string;
    kind: '库存' | '设备' | '临期';
    severity: '严重' | '一般' | '提示';
    resourceId: string;
    workspaceId: string;
    createdAt: number;
    description: string;
    suggestion: string;
    status: '未处理' | '已处理' | '已忽略';
};

export function stateTone(status: string): StateTone {
    if (['严重短缺', '故障', '已逾期'].includes(status)) return 'destructive';
    if (['库存不足', '维护中'].includes(status)) return 'caution';
    if (['临期', '待处理', '待审批', '未处理'].includes(status)) return 'warning';
    if (['可用', '运行中', '已完成', '已批准', '已处理'].includes(status)) return 'success';
    if (['待检验', '空闲'].includes(status)) return 'primary';
    return 'neutral';
}
export const exceptionTone = (item: ExceptionItem): StateTone =>
    item.severity === '严重' ? 'destructive' : item.severity === '一般' ? 'caution' : 'primary';

export type OverviewData = {
    stats: { label: string; value: number; delta: number }[];
    inventoryAlerts: { label: string; value: number }[];
    equipmentStatus: { label: string; value: number }[];
    recentItems: { resourceId: string; visitedAt: number }[];
    expiringItems: { name: string; description: string; days: number }[];
    inventoryTrend: number;
};
export type WorkbenchSnapshot = {
    resources: Resource[];
    tasks: Task[];
    approvals: Approval[];
    exceptions: ExceptionItem[];
    overviews: Record<string, OverviewData>;
};
