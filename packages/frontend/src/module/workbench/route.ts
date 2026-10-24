import type { RouteRecordRaw } from 'vue-router';
import OverviewView from './view/overview/OverviewView.vue';
import { ApprovalQueueView, ApprovalComposeView, ApprovalDetailView } from '@/module/approval/ui';
import ExceptionAlertView from './view/exception-alert/ExceptionAlertView.vue';
import { workbenchPage } from './navigation';

const pages = {
    overview: OverviewView,
    'my-task': ApprovalQueueView,
    'pending-approval': ApprovalQueueView,
    'exception-alert': ExceptionAlertView,
};
export const workbenchRoutes: RouteRecordRaw[] = Object.values(workbenchPage).map((page) => ({
    path: page.route,
    component: pages[page.route],
    props:
        page.route === 'my-task'
            ? { initialView: 'execute', allowMine: true }
            : page.route === 'pending-approval'
              ? { initialView: 'review' }
              : undefined,
    meta: { defaultTitle: page.route, pageLabel: page.label },
}));
workbenchRoutes.push(
    {
        path: 'request/new',
        component: ApprovalComposeView,
        meta: { defaultTitle: '新建申请', pageLabel: '新建申请' },
    },
    {
        path: 'request/:requestId',
        component: ApprovalDetailView,
        meta: { defaultTitle: '申请详情', pageLabel: '申请详情' },
    }
);
