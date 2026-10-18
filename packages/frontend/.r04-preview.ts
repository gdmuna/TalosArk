import { createApp, ref } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import { HttpError } from '@/platform/http';
import { useNavigationStore } from '@/platform/navigation';
import { useWorkspaceStore } from '@/module/workspace';
import { useAccountStore } from '@/module/account';
import { auditDataSourceKey, type AuditDataSource, type AuditEvent } from '@/module/audit';
import AuditLog from '@/page/management/AuditLog.vue';
import AuditDetail from '@/page/management/audit/Detail.vue';
import Root from './.r04-preview.vue';
import '@/style.css';

export const mode = ref('normal');
export const lastRead = ref('尚未读取');
const events: AuditEvent[] = Array.from({ length: 26 }, (_, index) => ({
    id: `AUD-ISOLATED-${String(index + 1).padStart(3, '0')}`,
    organization: { id: 'org-a', name: '隔离验收组织' },
    workspace:
        index === 5
            ? null
            : {
                  id: index % 3 === 0 ? 'workspace-b' : 'workspace-a',
                  name: index % 3 === 0 ? '共享实验平台' : '王教授课题组',
              },
    actor:
        index === 5
            ? null
            : { userId: `user-${index % 3}`, name: ['王教授', '李华', '张晓明'][index % 3] },
    action: index % 2 === 0 ? 'team.role.updated' : 'workspace.created',
    actionLabel: index % 2 === 0 ? '更新角色定义' : '创建工作区',
    occurredAt: new Date(Date.UTC(2026, 9, 18, 9, 30 - index)).toISOString(),
    requestId: `isolated-request-${index + 1}`,
    resources:
        index === 5
            ? []
            : [
                  {
                      resourceId: `resource-${index + 1}`,
                      labelSnapshot:
                          index === 1
                              ? '长名称资源：生命科学与多组学联合研究中心共享实验平台第二期实验室'
                              : index % 2 === 0
                                ? '研究员角色'
                                : '细胞培养实验室',
                  },
              ],
    description: '隔离审计记录，用于验收前端信息层级与交互，不表示真实组织活动。',
    facts:
        index % 2 === 0
            ? [
                  { label: '角色名称', value: '研究员' },
                  { label: '变更内容', value: '更新已注册权限集合' },
              ]
            : [],
}));
function fail() {
    if (mode.value === 'denied') throw new HttpError('PRIVATE FORBIDDEN DETAIL', 'http', 403);
    if (mode.value === 'unavailable') throw new HttpError('PRIVATE SERVICE DETAIL', 'http', 503);
    if (mode.value === 'invalid') throw new HttpError('PRIVATE CURSOR DETAIL', 'http', 400);
}
const source: AuditDataSource = {
    async list(scope, query, signal) {
        lastRead.value = JSON.stringify({ scope, query, aborted: signal.aborted });
        fail();
        let filtered = events.filter(
            (event) =>
                event.organization.id === scope.organizationId &&
                (!scope.workspaceId || event.workspace?.id === scope.workspaceId)
        );
        if (mode.value === 'empty') filtered = [];
        if (query.action) filtered = filtered.filter((event) => event.action === query.action);
        if (query.resourceId)
            filtered = filtered.filter((event) =>
                event.resources.some((resource) => resource.resourceId === query.resourceId)
            );
        if (query.from) filtered = filtered.filter((event) => event.occurredAt >= query.from!);
        if (query.until) filtered = filtered.filter((event) => event.occurredAt < query.until!);
        const offset = query.cursor ? Number(query.cursor.replace('isolated-cursor-', '')) : 0;
        if (!Number.isFinite(offset)) throw new HttpError('PRIVATE INVALID CURSOR', 'http', 400);
        const items = filtered.slice(offset, offset + query.limit);
        return {
            items:
                mode.value === 'wrong-scope'
                    ? items.map((item) => ({
                          ...item,
                          organization: { id: 'org-other', name: '不可泄漏组织' },
                      }))
                    : items,
            nextCursor:
                offset + query.limit < filtered.length
                    ? `isolated-cursor-${offset + query.limit}`
                    : null,
        };
    },
    async event(scope, id) {
        fail();
        const event = events.find(
            (event) =>
                event.id === id &&
                event.organization.id === scope.organizationId &&
                (!scope.workspaceId || event.workspace?.id === scope.workspaceId)
        );
        if (!event) throw new HttpError('PRIVATE NOT FOUND', 'http', 404);
        return event;
    },
};
const app = createApp(Root);
const pinia = createPinia();
app.use(pinia);
const account = useAccountStore(pinia);
account.profile = { id: 'isolated-user', username: 'isolated', displayName: '隔离验收', email: '' };
const workspace = useWorkspaceStore(pinia);
workspace.organizations = [
    { id: 'org-a', name: '隔离验收组织', canCreateWorkspace: false },
    { id: 'org-b', name: '第二隔离组织', canCreateWorkspace: false },
];
workspace.workspaces = [
    { id: 'workspace-a', organizationId: 'org-a', name: '王教授课题组', description: '' },
    { id: 'workspace-b', organizationId: 'org-a', name: '共享实验平台', description: '' },
];
workspace.activeId = 'workspace-a';
const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: '/', redirect: '/main/management/audit-log' },
        {
            path: '/main/management/audit-log',
            component: AuditLog,
            meta: { pageLabel: '审计日志' },
        },
        {
            path: '/main/management/audit-log/:eventId',
            component: AuditDetail,
            meta: { pageLabel: '审计事件详情' },
        },
    ],
});
if (!new URLSearchParams(location.search).has('without-source'))
    app.provide(auditDataSourceKey, source);
app.use(router);
useNavigationStore(pinia).initialize(router);
app.mount('#app');
