import { computed, onScopeDispose, ref } from 'vue';
import { defineStore } from 'pinia';
import { createTaskScope, waitFor } from '@/platform/task';
import { useWorkspaceStore } from '@/module/workspace';
import { formatTime, isToday } from '@/shared/util/date-time';
import { useWorkbenchClock } from './clock';
import { isTaskOverdueAt } from './workbench';
import type { WorkbenchDataSource } from '../data/source';
import type {
    Approval,
    ExceptionItem,
    OverviewData,
    Resource,
    Task,
    WorkbenchSnapshot,
} from './workbench';

export const useWorkbenchStore = defineStore('workbench', () => {
    const resources = ref<Resource[]>([]);
    const tasks = ref<Task[]>([]);
    const approvals = ref<Approval[]>([]);
    const exceptions = ref<ExceptionItem[]>([]);
    const workspace = useWorkspaceStore();
    const overviews = ref<Record<string, OverviewData>>({});
    const emptyOverview: OverviewData = {
        recentItems: [],
    };
    const busy = ref(false);
    const error = ref('');
    const syncError = ref('');
    const now = useWorkbenchClock();
    let source: WorkbenchDataSource;
    let sourceScope = createTaskScope([]);
    onScopeDispose(() => sourceScope.dispose());
    const currentResources = computed(() =>
        resources.value.filter((item) => item.workspaceId === workspace.activeId)
    );
    const currentApprovals = computed(() =>
        approvals.value.filter((item) => item.workspaceId === workspace.activeId)
    );
    const approvalById = computed(() => {
        const index = new Map<string, Approval>();
        for (const approval of currentApprovals.value) {
            if (!index.has(approval.id)) index.set(approval.id, approval);
        }
        return index;
    });
    const resolvedTasks = computed(() =>
        tasks.value
            .filter((item) => item.workspaceId === workspace.activeId)
            .map((item) => {
                if (!item.approvalId) return item;
                const approval = approvalById.value.get(item.approvalId);
                if (!approval) return item;
                return {
                    ...item,
                    applicant: approval.applicant,
                    createdAt: approval.createdAt,
                    status:
                        approval.status === '待审批' ? ('待处理' as const) : ('已完成' as const),
                };
            })
    );
    // Change the table's data identity only at a day/status boundary, invalidating its row cache.
    const timeKey = computed(() =>
        JSON.stringify([
            new Date(now.value).toDateString(),
            ...resolvedTasks.value.map((task) => isTaskOverdueAt(task, now.value)),
        ])
    );
    const currentTasks = computed(() => {
        void timeKey.value;
        return [...resolvedTasks.value];
    });
    const overdue = (task: Task) => isTaskOverdueAt(task, now.value);
    const displayStatus = (task: Task) => (overdue(task) ? '已逾期' : task.status);
    const today = (value: number) => isToday(value, now.value);
    const displayTime = (value: number) => formatTime(value, now.value);
    const currentExceptions = computed(() =>
        exceptions.value.filter((item) => item.workspaceId === workspace.activeId)
    );
    const overview = computed(() => ({
        recentItems: (overviews.value[workspace.activeId] ?? emptyOverview).recentItems,
    }));
    const resourceById = computed(
        () => new Map(currentResources.value.map((item) => [item.id, item]))
    );
    function apply(snapshot: WorkbenchSnapshot) {
        resources.value = snapshot.resources;
        tasks.value = snapshot.tasks;
        approvals.value = snapshot.approvals;
        exceptions.value = snapshot.exceptions;
        overviews.value = snapshot.overviews;
    }
    function connect(dataSource: WorkbenchDataSource) {
        sourceScope.dispose();
        sourceScope = createTaskScope([]);
        source = dataSource;
    }
    async function load(signal?: AbortSignal) {
        const task = createTaskScope([sourceScope.signal, signal]);
        try {
            task.signal.throwIfAborted();
            const snapshot = await waitFor(source.load(task.signal), task.signal);
            task.signal.throwIfAborted();
            apply(snapshot);
        } finally {
            task.dispose();
        }
    }
    async function initialize(dataSource: WorkbenchDataSource) {
        connect(dataSource);
        await load();
    }
    async function mutate(operation: () => Promise<unknown>) {
        if (busy.value) return '数据正在更新，请稍后重试';
        if (syncError.value) return (error.value = '请先重新同步工作台数据');
        busy.value = true;
        error.value = '';
        try {
            await operation();
            await synchronize();
        } catch (cause) {
            error.value = cause instanceof Error ? cause.message : '更新失败，请重试';
        } finally {
            busy.value = false;
        }
        return error.value;
    }
    async function synchronize() {
        try {
            apply(await source.load());
            syncError.value = '';
        } catch (cause) {
            syncError.value = cause instanceof Error ? cause.message : '工作台数据同步失败';
        }
    }
    async function retrySync() {
        if (busy.value || !syncError.value) return;
        busy.value = true;
        try {
            await synchronize();
        } finally {
            busy.value = false;
        }
    }
    const completeTasks = (ids: string[]) => mutate(() => source.completeTasks(ids));
    const decideApprovals = (ids: string[], status: '已批准' | '已退回', note: string) =>
        mutate(() => source.decideApprovals(ids, status, note));
    const updateExceptions = (ids: string[], status: '已处理' | '已忽略') =>
        mutate(() => source.updateExceptions(ids, status));
    const updateException = (id: string, status: '已处理' | '已忽略') =>
        updateExceptions([id], status);
    async function addInspection(resource: Resource) {
        let id: string | null = null;
        const error = await mutate(async () => {
            id = await source.addInspection(resource.id);
        });
        return error ? null : id;
    }
    return {
        resources,
        tasks,
        approvals,
        exceptions,
        overview,
        currentResources,
        currentTasks,
        currentApprovals,
        currentExceptions,
        resourceById,
        overdue,
        displayStatus,
        today,
        displayTime,
        busy,
        error,
        syncError,
        connect,
        load,
        initialize,
        retrySync,
        completeTasks,
        decideApprovals,
        updateException,
        updateExceptions,
        addInspection,
    };
});
