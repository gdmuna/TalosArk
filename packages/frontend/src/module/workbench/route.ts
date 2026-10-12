import type { RouteRecordRaw } from 'vue-router';
import OverviewView from './view/overview/OverviewView.vue';
import MyTaskView from './view/my-task/MyTaskView.vue';
import PendingApprovalView from './view/pending-approval/PendingApprovalView.vue';
import ExceptionAlertView from './view/exception-alert/ExceptionAlertView.vue';
import { workbenchPage } from './navigation';

const pages = {
    overview: OverviewView,
    'my-task': MyTaskView,
    'pending-approval': PendingApprovalView,
    'exception-alert': ExceptionAlertView,
};
export const workbenchRoutes: RouteRecordRaw[] = Object.values(workbenchPage).map((page) => ({
    path: page.route,
    component: pages[page.route],
    meta: { defaultTitle: page.route, pageLabel: page.label },
}));
