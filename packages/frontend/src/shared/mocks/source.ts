import type {
    AccountDataSource,
    WorkspaceDataSource,
    WorkbenchDataSource,
} from '@/shared/data/source';
import { createWorkspaceFixtures } from './workspace';
import { createWorkbenchFixtures } from './workbench';
import { createAccountFixture } from './account';

export function createMockDataSources(): {
    account: AccountDataSource;
    workspace: WorkspaceDataSource;
    workbench: WorkbenchDataSource;
} {
    const workspace = createWorkspaceFixtures();
    const workbench = createWorkbenchFixtures();
    const account = createAccountFixture();
    return {
        account: {
            async load() {
                return structuredClone(account);
            },
            async updateDisplayName(name) {
                const trimmed = name.trim();
                if (!trimmed || trimmed.length > 40) throw new Error('显示名称须为 1-40 个字符');
                account.displayName = trimmed;
            },
        },
        workspace: {
            async load() {
                return structuredClone(workspace);
            },
            async create(name, organizationId) {
                const trimmed = name.trim();
                if (!trimmed || trimmed.length > 40) throw new Error('工作区名称须为 1-40 个字符');
                if (!workspace.organizations.some((item) => item.id === organizationId))
                    throw new Error('组织不存在');
                if (
                    workspace.workspaces.some(
                        (item) => item.organizationId === organizationId && item.name === trimmed
                    )
                )
                    throw new Error('该组织中已存在同名工作区');
                const id = crypto.randomUUID();
                workspace.workspaces.push({ id, organizationId, name: trimmed, description: '' });
                return id;
            },
            async join(code) {
                if (code.trim().toUpperCase() !== 'ARK-LAB2026')
                    throw new Error('邀请码无效或已过期');
                if (!workspace.workspaces.some((item) => item.id === 'imaging'))
                    workspace.workspaces.push({
                        id: 'imaging',
                        organizationId: 'suzhou',
                        name: '细胞成像平台',
                        description: '显微成像与分析',
                    });
                return 'imaging';
            },
        },
        workbench: {
            async load() {
                return structuredClone(workbench);
            },
            async completeTasks(ids) {
                const tasks = ids.map((id) => workbench.tasks.find((item) => item.id === id));
                if (tasks.some((item) => !item || item.kind === '审批' || item.status !== '待处理'))
                    throw new Error('仅可完成待处理的普通任务；审批申请请进入审批流程');
                workbench.tasks
                    .filter((item) => ids.includes(item.id))
                    .forEach((item) => {
                        item.status = '已完成';
                    });
            },
            async decideApprovals(ids, status, note) {
                if (status === '已退回' && !note.trim())
                    throw new Error('退回申请时须填写审批意见');
                const items = ids.map((id) => workbench.approvals.find((item) => item.id === id));
                if (items.some((item) => !item || item.status !== '待审批'))
                    throw new Error('申请状态已变更');
                if (
                    status === '已批准' &&
                    items.some((item) => item && item.quantity > item.available)
                )
                    throw new Error('当前可用数量不足，不能批准该申请');
                // Validate the entire batch before changing any application.
                items.forEach((item) => {
                    if (item) {
                        item.status = status;
                        item.reviewNote = note.trim();
                    }
                });
            },
            async updateExceptions(ids, status) {
                const items = ids.map((id) =>
                    workbench.exceptions.find((entry) => entry.id === id)
                );
                if (items.some((item) => !item || item.status !== '未处理'))
                    throw new Error('异常状态已变更');
                items.forEach((item) => {
                    if (item) item.status = status;
                });
            },
            async addInspection(resourceId) {
                const resource = workbench.resources.find(
                    (item) => item.id === resourceId && item.kind === '设备'
                );
                if (!resource) throw new Error('设备不存在');
                const id = crypto.randomUUID();
                const due = new Date();
                due.setDate(due.getDate() + 1);
                due.setHours(17, 0, 0, 0);
                workbench.tasks.push({
                    id,
                    title: `${resource.name}巡检`,
                    subtitle: '设备例行巡检',
                    kind: '任务',
                    resourceId,
                    workspaceId: resource.workspaceId,
                    applicant: '王教授',
                    createdAt: Date.now(),
                    dueAt: due.getTime(),
                    status: '待处理',
                });
                return id;
            },
        },
    };
}
