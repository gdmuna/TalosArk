import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNodeStore } from '@/stores/node';

const { flatNodes } = vi.hoisted(() => ({
    flatNodes: [
        {
            id: 'n1',
            name: 'Root A',
            type: 'ROOT' as const,
            parentId: null,
            orgId: 'org-1',
            metadata: null,
            gridConfig: null,
            description: null,
            createdAt: '',
            updatedAt: '',
        },
        {
            id: 'n2',
            name: 'Container B',
            type: 'CONTAINER' as const,
            parentId: 'n1',
            orgId: 'org-1',
            metadata: null,
            gridConfig: null,
            description: null,
            createdAt: '',
            updatedAt: '',
        },
    ],
}));

vi.mock('@/shared/api/module/node', () => ({
    fetchNodeTree: vi.fn().mockImplementation(() => Promise.resolve([...flatNodes])),
    getNode: vi.fn().mockImplementation(() => Promise.resolve(flatNodes[0])),
    createNode: vi.fn().mockImplementation(() =>
        Promise.resolve({
            id: 'n3',
            name: 'Box C',
            type: 'BOX' as const,
            parentId: 'n2',
            orgId: 'org-1',
            metadata: null,
            gridConfig: null,
            description: null,
            createdAt: '',
            updatedAt: '',
        })
    ),
    deleteNode: vi.fn().mockImplementation(() => Promise.resolve()),
    updateNode: vi.fn().mockImplementation(() =>
        Promise.resolve({
            ...flatNodes[0],
            name: 'Root A Updated',
        })
    ),
}));

describe('useNodeStore', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('fetchByOrg loads flat nodes', async () => {
        const store = useNodeStore();
        await store.fetchByOrg('org-1');
        expect(store.nodes.length).toBe(2);
        expect(store.nodes[0].type).toBe('ROOT');
        expect(store.nodes[1].type).toBe('CONTAINER');
    });

    it('treeNodes builds tree from flat list', async () => {
        const store = useNodeStore();
        await store.fetchByOrg('org-1');
        const tree = store.treeNodes;
        // 1 root with 1 child
        expect(tree.length).toBe(1);
        expect(tree[0].id).toBe('n1');
        expect(tree[0].children?.length).toBe(1);
        expect(tree[0].children?.[0].id).toBe('n2');
    });

    it('addNode appends to flat list', async () => {
        const store = useNodeStore();
        await store.fetchByOrg('org-1');
        await store.addNode({ orgId: 'org-1', name: 'Box C', type: 'BOX', parentId: 'n2' });
        expect(store.nodes.length).toBe(3);
    });

    it('removeNode removes from flat list', async () => {
        const store = useNodeStore();
        await store.fetchByOrg('org-1');
        await store.removeNode('n1');
        expect(store.nodes.length).toBe(1);
        expect(store.nodes[0].id).toBe('n2');
    });

    it('editNode updates the node in flat list', async () => {
        const store = useNodeStore();
        await store.fetchByOrg('org-1');
        await store.editNode({ id: 'n1', name: 'Root A Updated' });
        const updated = store.nodes.find((n) => n.id === 'n1');
        expect(updated?.name).toBe('Root A Updated');
    });
});
