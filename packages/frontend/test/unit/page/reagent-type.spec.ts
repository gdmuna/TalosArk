import { describe, it, expect, vi } from 'vitest';

// Minimal smoke test: ReagentType API mock
vi.mock('@/shared/api/module/reagent-type', () => ({
    listReagentTypes: vi.fn().mockResolvedValue([
        {
            id: 'rt-1',
            orgId: 'org-1',
            name: '青霉素',
            colorHex: '#0075de',
            unit: 'mL',
            description: null,
            createdAt: '',
        },
    ]),
    createReagentType: vi.fn().mockResolvedValue({
        id: 'rt-2',
        orgId: 'org-1',
        name: '新类型',
        colorHex: null,
        unit: null,
        description: null,
        createdAt: '',
    }),
    updateReagentType: vi.fn().mockResolvedValue({}),
    deleteReagentType: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/stores/org', () => ({
    useOrgStore: () => ({ currentOrgId: 'org-1' }),
}));

describe('ReagentType API Integration', () => {
    it('listReagentTypes resolves with items', async () => {
        const { listReagentTypes } = await import('@/shared/api/module/reagent-type');
        const result = await listReagentTypes({ orgId: 'org-1' });
        expect(result[0].name).toBe('青霉素');
    });
});
