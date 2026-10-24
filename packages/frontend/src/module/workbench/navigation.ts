import { ClipboardCheck, LayoutDashboard, ListTodo, TriangleAlert } from '@lucide/vue';

export const workbenchPath = '/main/workbench';
export const workbenchPage = {
    overview: {
        id: 'overview',
        route: 'overview',
        path: `${workbenchPath}/overview`,
        label: '概览',
        icon: LayoutDashboard,
        commandId: 'overview',
        commandLabel: '工作台总览',
        keywords: '首页 工作台 总览',
    },
    task: {
        id: 'my-tasks',
        route: 'my-task',
        path: `${workbenchPath}/my-task`,
        label: '我的待办',
        icon: ListTodo,
        commandId: 'tasks',
        commandLabel: '我的待办',
        keywords: '任务 待办 我的',
    },
    approval: {
        id: 'pending-approvals',
        route: 'pending-approval',
        path: `${workbenchPath}/pending-approval`,
        label: '待审批',
        icon: ClipboardCheck,
        commandId: 'approvals',
        commandLabel: '待审批',
        keywords: '审批 申请',
    },
    exception: {
        id: 'exceptions-alerts',
        route: 'exception-alert',
        path: `${workbenchPath}/exception-alert`,
        label: '异常与提醒',
        icon: TriangleAlert,
        commandId: 'alerts',
        commandLabel: '异常与提醒',
        keywords: '告警 异常 提醒',
    },
} as const;
