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
    getReagent,
    listReagents,
    updateReagent,
    createReagent,
    createBoxAlias,
    deleteBoxAlias,
    listBoxAliases,
    updateBoxAlias,
} from '@/shared/api/module/box';

describe('box API module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Reagent ───────────────────────────────────────────────────────────

    describe('getReagent', () => {
        it('calls Get /reagent/one with id as query param', () => {
            getReagent('reagent-1');
            expect(api.get).toHaveBeenCalledWith('/reagent/one', {
                params: { id: 'reagent-1' },
            });
        });
    });

    describe('listReagents', () => {
        it('calls Get /reagent/list with nodeId', () => {
            listReagents('node-1');
            expect(api.get).toHaveBeenCalledWith('/reagent/list', {
                params: { nodeId: 'node-1' },
            });
        });
    });

    describe('updateReagent', () => {
        it('calls Put /reagent/update with update payload', () => {
            const data = { id: 'reagent-1', name: 'Sample X', position: '1-1' };
            updateReagent(data);
            expect(api.put).toHaveBeenCalledWith('/reagent/update', data);
        });
    });

    describe('createReagent', () => {
        it('calls Post /reagent/add with full payload', () => {
            const data = { nodeId: 'node-1', position: '1-1', name: 'Sample A' };
            createReagent(data);
            expect(api.post).toHaveBeenCalledWith('/reagent/add', data);
        });

        it('calls Post /reagent/add with optional fields', () => {
            const data = {
                nodeId: 'node-1',
                position: '2-3',
                name: 'Sample B',
                description: 'desc',
                reagentTypeId: 'type-1',
            };
            createReagent(data);
            expect(api.post).toHaveBeenCalledWith('/reagent/add', data);
        });
    });

    // ── Box Alias ─────────────────────────────────────────────────────────

    describe('createBoxAlias', () => {
        it('calls Post /box/alias/add with boxId and alias', () => {
            const data = { boxId: 'box-1', alias: 'CryoBox-A' };
            createBoxAlias(data);
            expect(api.post).toHaveBeenCalledWith('/box/alias/add', data);
        });
    });

    describe('deleteBoxAlias', () => {
        it('calls Delete /box/alias/del with alias id in data body', () => {
            deleteBoxAlias('alias-99');
            expect(api.delete).toHaveBeenCalledWith('/box/alias/del', { id: 'alias-99' });
        });
    });

    describe('listBoxAliases', () => {
        it('calls Get /box/alias/list with boxId', () => {
            listBoxAliases('box-1');
            expect(api.get).toHaveBeenCalledWith('/box/alias/list', {
                params: { boxId: 'box-1' },
            });
        });
    });

    describe('updateBoxAlias', () => {
        it('calls Put /box/alias/update with id and new alias', () => {
            const data = { id: 'alias-1', alias: 'NewAlias' };
            updateBoxAlias(data);
            expect(api.put).toHaveBeenCalledWith('/box/alias/update', data);
        });
    });
});
