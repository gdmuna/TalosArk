import { computed, inject, type InjectionKey, type Ref } from 'vue';
import { HttpError } from '@/platform/http';
import { organizationPolicySchema, type OrganizationPolicyDataSource } from '../data/source';
import { useOrganizationRead } from './read';

export const organizationPolicyDataSourceKey: InjectionKey<OrganizationPolicyDataSource> =
    Symbol('organizationPolicy');
export function useOrganizationPolicy(
    context: Ref<{ accountId: string; organizationId: string } | null>
) {
    const source = inject(organizationPolicyDataSourceKey, null);
    const key = computed(() => (source && context.value ? JSON.stringify(context.value) : ''));
    const state = useOrganizationRead(key, async (signal) => {
        const selected = context.value;
        if (!source || !selected) return;
        const response = await source.read(selected.organizationId, signal);
        const parsed = organizationPolicySchema.safeParse(response);
        if (!parsed.success || parsed.data.organizationId !== selected.organizationId)
            throw new HttpError('组织策略响应无效', 'protocol');
        return parsed.data;
    });
    return { ...state, available: !!source };
}
