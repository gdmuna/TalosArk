import type { RouteRecordRaw } from 'vue-router';

export const workbenchRoutes: RouteRecordRaw[] = [
    {
        path: 'overview',
        component: () => import('./view/overview/OverviewView.vue'),
        meta: { defaultTitle: 'overview' },
    },
    {
        path: 'my-task',
        component: () => import('./view/my-task/MyTaskView.vue'),
        meta: { defaultTitle: 'my-task' },
    },
    {
        path: 'pending-approval',
        component: () => import('./view/pending-approval/PendingApprovalView.vue'),
        meta: { defaultTitle: 'pending-approval' },
    },
    {
        path: 'exception-alert',
        component: () => import('./view/exception-alert/ExceptionAlertView.vue'),
        meta: { defaultTitle: 'exception-alert' },
    },
];
