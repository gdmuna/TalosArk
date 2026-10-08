import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { reactive } from 'vue';

const orgStore = reactive({
    currentOrgId: 'org-1' as string | null,
    orgs: [],
    currentOrg: null,
    fetchOrgs: vi.fn(),
    selectOrg: vi.fn(),
});

vi.mock('@/stores/org', () => ({
    useOrgStore: () => orgStore,
}));

vi.mock('@/stores/auth', () => ({
    useAuthStore: () => ({ user: { nickname: 'Test', username: 'test' } }),
}));

vi.mock('@/stores/node', () => ({
    useNodeStore: () => ({
        nodes: [],
        treeNodes: [],
        rootNodes: [],
        boxNodes: [],
        loading: false,
        fetchNodes: vi.fn(),
        fetchByOrg: vi.fn(),
    }),
}));

vi.mock('@/stores/reagent', () => ({
    useReagentStore: () => ({
        reagents: [],
        reagentTypes: [],
        loading: false,
        fetchReagents: vi.fn(),
        fetchReagentTypes: vi.fn(),
        initData: vi.fn(),
    }),
}));

vi.mock('@/shared/utils/animation', () => ({
    fadeSlideIn: vi.fn(),
}));

vi.mock('@/components/node/NodeCanvas.vue', () => ({
    default: { template: '<div />' },
}));

import DashboardPage from '@/pages/dashboard/DashboardPage.vue';

describe('DashboardPage', () => {
    it('mounts without error', () => {
        const wrapper = shallowMount(DashboardPage);
        expect(wrapper.exists()).toBe(true);
    });
});
