export const notificationEvents = [
    {
        code: 'TASK_ASSIGNED',
        label: '任务指派',
        description: '有任务被指派给接收人',
        group: '任务与审批',
    },
    {
        code: 'TASK_COMPLETED',
        label: '任务完成',
        description: '相关任务已完成',
        group: '任务与审批',
    },
    {
        code: 'APPROVAL_REQUESTED',
        label: '审批待处理',
        description: '有审批申请需要处理',
        group: '任务与审批',
    },
    {
        code: 'APPROVAL_DECIDED',
        label: '审批结果',
        description: '相关审批已有处理结果',
        group: '任务与审批',
    },
    {
        code: 'ALERT',
        label: '异常与提醒',
        description: '来源业务触发的异常或提醒',
        group: '异常与提醒',
    },
] as const;

export function notificationEvent(code: string) {
    return notificationEvents.find((event) => event.code === code);
}
