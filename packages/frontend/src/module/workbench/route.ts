import type { RouteRecordRaw } from 'vue-router';
import OverviewView from './view/overview/OverviewView.vue';
import MyTaskView from './view/my-task/MyTaskView.vue';
import PendingApprovalView from './view/pending-approval/PendingApprovalView.vue';
import ExceptionAlertView from './view/exception-alert/ExceptionAlertView.vue';

export const workbenchRoutes: RouteRecordRaw[] = [
    {
        path: 'overview',
        component: OverviewView,
        meta: { defaultTitle: 'overview', pageLabel: '概览' },
    },
    {
        path: 'my-task',
        component: MyTaskView,
        meta: { defaultTitle: 'my-task', pageLabel: '我的待办' },
    },
    {
        path: 'pending-approval',
        component: PendingApprovalView,
        meta: { defaultTitle: 'pending-approval', pageLabel: '待审批' },
    },
    {
        path: 'exception-alert',
        component: ExceptionAlertView,
        meta: { defaultTitle: 'exception-alert', pageLabel: '异常与提醒' },
    },
];
