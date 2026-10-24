import { computed, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AuditQuery, AuditScope } from '@/module/audit';
import { useWorkspaceStore } from '@/module/workspace';

export const auditListPath = '/main/management/audit-log';

export function useAuditQuery(identity: Ref<string>) {
    const route = useRoute(),
        router = useRouter(),
        workspace = useWorkspaceStore();
    const text = (name: string) =>
        typeof route.query[name] === 'string' ? route.query[name] : undefined;
    const scope = computed<AuditScope>(() => ({
        organizationId:
            text('organization') ??
            workspace.organization?.id ??
            workspace.organizations[0]?.id ??
            '',
        workspaceId: text('workspace'),
    }));
    const query = computed<AuditQuery>(() => ({
        action: text('action'),
        resourceId: text('resource'),
        from: text('from'),
        until: text('until'),
        cursor: text('cursor'),
        limit: [20, 50, 100].includes(Number(text('limit'))) ? Number(text('limit')) : 20,
    }));
    const invalid = computed(() => {
        const { from, until } = query.value;
        if (
            (from && !Number.isFinite(Date.parse(from))) ||
            (until && !Number.isFinite(Date.parse(until)))
        )
            return '时间范围无效，请重新选择';
        if (from && until && Date.parse(from) >= Date.parse(until))
            return '结束时间必须晚于开始时间';
        if ((query.value.cursor?.length ?? 0) > 1024) return '游标无效，请返回首批重新查询';
        return '';
    });
    const key = computed(() =>
        identity.value && scope.value.organizationId && !invalid.value
            ? JSON.stringify([identity.value, scope.value, query.value])
            : ''
    );
    function update(values: Record<string, string | undefined>) {
        return router.replace({
            query: {
                ...route.query,
                organization: scope.value.organizationId,
                cursor: undefined,
                ...values,
            },
            hash: route.hash,
        });
    }
    return { scope, query, invalid, key, update };
}
