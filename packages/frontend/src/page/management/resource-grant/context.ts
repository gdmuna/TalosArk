import { computed } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import type { AccessScope, AccessReference } from '@/module/resource-access';

export const resourceGrantPath = '/main/management/resource-grant';
export const sharingPolicyPath = '/main/management/sharing-policy';

export function useAccessContext() {
    const route = useRoute(),
        router = useRouter(),
        account = useAccountStore(),
        workspace = useWorkspaceStore();
    const root = route.path === sharingPolicyPath ? sharingPolicyPath : resourceGrantPath;
    const identity = computed(() => account.profile?.id ?? '');
    const text = (name: string) =>
        typeof route.query[name] === 'string' ? route.query[name] : undefined;
    const scope = computed<AccessScope>(() => ({
        organizationId:
            route.query.organization === undefined
                ? (workspace.organization?.id ?? workspace.organizations[0]?.id ?? '')
                : (text('organization') ?? ''),
        workspaceId: text('workspace'),
    }));
    const organization = computed(() =>
        identity.value
            ? workspace.organizations.find((item) => item.id === scope.value.organizationId)
            : undefined
    );
    const invalid = computed(() => {
        if (!identity.value) return '请重新登录后查看';
        if (!organization.value) return '组织不存在或不在可访问范围内';
        if (
            route.query.workspace !== undefined &&
            (!scope.value.workspaceId ||
                !workspace.workspaces.some(
                    (item) =>
                        item.id === scope.value.workspaceId &&
                        item.organizationId === scope.value.organizationId
                ))
        )
            return '工作区不存在或不在可访问范围内';
        return '';
    });
    const key = computed(() =>
        (route.path === root || route.path.startsWith(`${root}/`)) && !invalid.value
            ? JSON.stringify([identity.value, scope.value])
            : ''
    );
    function update(values: LocationQueryRaw) {
        return router.replace({
            query: { ...route.query, page: undefined, ...values },
            hash: route.hash,
        });
    }
    const organizationOptions = computed(() =>
        identity.value
            ? workspace.organizations.map((item) => ({ value: item.id, label: item.name }))
            : []
    );
    const workspaceOptions = computed(() => [
        { value: 'all', label: '组织内全部工作区' },
        ...(identity.value
            ? workspace.workspaces
                  .filter((item) => item.organizationId === scope.value.organizationId)
                  .map((item) => ({ value: item.id, label: item.name }))
            : []),
    ]);
    const organizationId = computed({
        get: () => scope.value.organizationId,
        set: (id: string) => {
            void update({ organization: id, workspace: undefined });
        },
    });
    const workspaceId = computed({
        get: () => scope.value.workspaceId ?? 'all',
        set: (id: string) => {
            void update({ workspace: id === 'all' ? undefined : id });
        },
    });
    return {
        identity,
        scope,
        organization,
        key,
        invalid,
        organizationId,
        workspaceId,
        organizationOptions,
        workspaceOptions,
        update,
    };
}

export function accessReferenceTo(scope: AccessScope, reference: AccessReference) {
    return {
        path: `/main/management/${reference.kind}/${encodeURIComponent(reference.id)}`,
        query: { organization: scope.organizationId, workspace: reference.workspaceId },
    };
}
