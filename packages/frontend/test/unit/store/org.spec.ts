import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOrgStore } from '@/stores/org';
import type { Org } from '@/schemas/org.schema';

const { mockOrgs } = vi.hoisted(() => ({
    mockOrgs: [
        {
            id: 'org-1',
            name: 'BioLab Alpha',
            description: null,
            ownerId: 'user-1',
            createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
            id: 'org-2',
            name: 'BioLab Beta',
            description: 'Second lab',
            ownerId: 'user-2',
            createdAt: '2024-02-01T00:00:00.000Z',
        },
    ] as Org[],
}));

vi.mock('@/shared/api/module/org', () => ({
    listOrgs: vi.fn().mockResolvedValue(mockOrgs),
}));

describe('org store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('orgs is empty initially', () => {
        const org = useOrgStore();
        expect(org.orgs).toEqual([]);
    });

    it('currentOrgId is null initially', () => {
        const org = useOrgStore();
        expect(org.currentOrgId).toBeNull();
    });

    it('currentOrg is null initially', () => {
        const org = useOrgStore();
        expect(org.currentOrg).toBeNull();
    });

    it('fetchOrgs populates the orgs array', async () => {
        const org = useOrgStore();
        await org.fetchOrgs();
        expect(org.orgs).toEqual(mockOrgs);
    });

    it('fetchOrgs auto-selects first org when currentOrgId is null', async () => {
        const org = useOrgStore();
        await org.fetchOrgs();
        expect(org.currentOrgId).toBe('org-1');
    });

    it('fetchOrgs does not change currentOrgId if already set', async () => {
        const org = useOrgStore();
        org.selectOrg('org-2');
        await org.fetchOrgs();
        expect(org.currentOrgId).toBe('org-2');
    });

    it('selectOrg changes currentOrgId', () => {
        const org = useOrgStore();
        org.selectOrg('org-2');
        expect(org.currentOrgId).toBe('org-2');
    });

    it('currentOrg computed returns the correct org after fetchOrgs', async () => {
        const org = useOrgStore();
        await org.fetchOrgs();
        expect(org.currentOrg).toEqual(mockOrgs[0]);
    });

    it('currentOrg returns null when currentOrgId is not in orgs', () => {
        const org = useOrgStore();
        org.selectOrg('nonexistent-id');
        expect(org.currentOrg).toBeNull();
    });

    it('currentOrg updates when selectOrg is called', async () => {
        const org = useOrgStore();
        await org.fetchOrgs();
        org.selectOrg('org-2');
        expect(org.currentOrg).toEqual(mockOrgs[1]);
    });
});
