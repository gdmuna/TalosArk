import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

import api from '@/shared/api/client';
import {
    createOrg,
    deleteOrg,
    getOrg,
    listOrgs,
    searchOrgs,
    updateOrg,
} from '@/shared/api/module/org';

describe('org API module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createOrg', () => {
        it('calls Post /org/create with name', () => {
            const data = { name: 'Lab A' };
            createOrg(data);
            expect(api.post).toHaveBeenCalledWith('/org/create', data);
        });

        it('calls Post /org/create with name and description', () => {
            const data = { name: 'Lab B', description: 'Biochemistry lab' };
            createOrg(data);
            expect(api.post).toHaveBeenCalledWith('/org/create', data);
        });
    });

    describe('deleteOrg', () => {
        it('calls Delete /org/del with orgId in data body', () => {
            deleteOrg('org-1');
            expect(api.delete).toHaveBeenCalledWith('/org/del', { orgId: 'org-1' });
        });
    });

    describe('getOrg', () => {
        it('calls Get /org/one with orgId param', () => {
            getOrg('org-1');
            expect(api.get).toHaveBeenCalledWith('/org/one', {
                params: { orgId: 'org-1' },
            });
        });
    });

    describe('listOrgs', () => {
        it('calls Get /org/list with no parameters', () => {
            listOrgs();
            expect(api.get).toHaveBeenCalledWith('/org/list');
        });
    });

    describe('searchOrgs', () => {
        it('calls Get /org/search with keyword', () => {
            const params = { keyword: 'bio' };
            searchOrgs(params);
            expect(api.get).toHaveBeenCalledWith('/org/search', { params });
        });

        it('calls Get /org/search with keyword and limit', () => {
            const params = { keyword: 'chem', limit: 5 };
            searchOrgs(params);
            expect(api.get).toHaveBeenCalledWith('/org/search', { params });
        });
    });

    describe('updateOrg', () => {
        it('calls Put /org/update with orgId and new name', () => {
            const data = { orgId: 'org-1', name: 'Updated Lab' };
            updateOrg(data);
            expect(api.put).toHaveBeenCalledWith('/org/update', data);
        });

        it('calls Put /org/update with description only', () => {
            const data = { orgId: 'org-1', description: 'New description' };
            updateOrg(data);
            expect(api.put).toHaveBeenCalledWith('/org/update', data);
        });
    });
});
