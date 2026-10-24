import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import { useOrganizationDataSource, useOrganizationRead } from '@/module/organization';
import { HttpError } from '@/platform/http';

export function useOrganizationContext() {
    const route = useRoute();
    const router = useRouter();
    const workspace = useWorkspaceStore();
    const account = useAccountStore();
    const source = useOrganizationDataSource();
    const path = route.path;
    const organizationId = computed({
        get: () =>
            route.query.organization === undefined
                ? (workspace.organization?.id ?? workspace.organizations[0]?.id ?? '')
                : typeof route.query.organization === 'string'
                  ? route.query.organization
                  : '',
        set: (id: string) => {
            if (route.path !== path || !workspace.organizations.some((item) => item.id === id))
                return;
            void router.replace({
                path,
                query: { ...route.query, organization: id },
                hash: route.hash,
            });
        },
    });
    const identity = computed(() => account.profile?.id ?? '');
    const organization = computed(() =>
        identity.value
            ? workspace.organizations.find((item) => item.id === organizationId.value)
            : undefined
    );
    const key = computed(() =>
        route.path === path && identity.value && organization.value
            ? JSON.stringify([identity.value, organizationId.value])
            : ''
    );
    const profileKey = computed(() => (source ? key.value : ''));
    const profile = useOrganizationRead(profileKey, async (signal) => {
        if (!source) return;
        const id = organizationId.value;
        const value = await source.profile(id, signal);
        if (value.id !== id) throw new HttpError('组织响应范围不匹配', 'protocol');
        return value;
    });
    const options = computed(() =>
        identity.value
            ? workspace.organizations.map((item) => ({ value: item.id, label: item.name }))
            : []
    );
    return { workspace, source, organizationId, organization, identity, key, profile, options };
}
