import { computed, watch } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';

export const facilityPath = '/main/management/facility';
export const governancePath = '/main/management/storage-governance';
export function useFacilityContext() {
    const route = useRoute(),
        router = useRouter(),
        account = useAccountStore(),
        workspace = useWorkspaceStore();
    const scope = computed(() => ({
        organizationId:
            route.query.organization === undefined
                ? (workspace.organization?.id ?? workspace.organizations[0]?.id ?? '')
                : typeof route.query.organization === 'string'
                  ? route.query.organization
                  : '',
    }));
    const organization = computed(() =>
        account.profile?.id
            ? workspace.organizations.find((item) => item.id === scope.value.organizationId)
            : undefined
    );
    const invalid = computed(() =>
        !account.profile?.id
            ? '请重新登录后查看'
            : !organization.value
              ? '组织不存在或不在可访问范围内'
              : ''
    );
    const key = computed(() =>
        !invalid.value ? JSON.stringify([account.profile?.id, scope.value.organizationId]) : ''
    );
    const options = computed(() =>
        account.profile?.id
            ? workspace.organizations.map((item) => ({ value: item.id, label: item.name }))
            : []
    );
    function update(values: LocationQueryRaw) {
        return router.replace({
            query: { ...route.query, page: undefined, ...values },
            hash: route.hash,
        });
    }
    const organizationId = computed({
        get: () => scope.value.organizationId,
        set: (id: string) => {
            void update({
                organization: id,
                facility: undefined,
                topology: undefined,
                node: undefined,
            });
        },
    });
    watch(
        key,
        (value) => {
            if (value && route.query.organization === undefined)
                void router.replace({
                    query: { ...route.query, organization: scope.value.organizationId },
                    hash: route.hash,
                });
        },
        { immediate: true }
    );
    return { scope, organization, invalid, key, options, organizationId, update };
}
export function facilityDate(value: string | null) {
    return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : '—';
}
