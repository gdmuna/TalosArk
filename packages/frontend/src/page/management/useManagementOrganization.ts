import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';

export function useManagementOrganization(path: string) {
    const route = useRoute();
    const router = useRouter();
    const account = useAccountStore();
    const workspace = useWorkspaceStore();
    const organizationId = computed({
        get: () =>
            route.query.organization === undefined
                ? (workspace.organization?.id ?? workspace.organizations[0]?.id ?? '')
                : typeof route.query.organization === 'string'
                  ? route.query.organization
                  : '',
        set: (value: string) => {
            if (route.path !== path || !workspace.organizations.some((item) => item.id === value))
                return;
            void router.replace({
                path,
                query: { ...route.query, organization: value },
                hash: route.hash,
            });
        },
    });
    const organization = computed(() =>
        account.profile
            ? workspace.organizations.find((item) => item.id === organizationId.value)
            : undefined
    );
    const options = computed(() =>
        account.profile
            ? workspace.organizations.map((item) => ({ value: item.id, label: item.name }))
            : []
    );
    const context = computed(() =>
        account.profile && organization.value && route.path === path
            ? { accountId: account.profile.id, organizationId: organization.value.id }
            : null
    );
    return { organizationId, organization, options, context };
}
