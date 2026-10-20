import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { createHttpInventoryDataSource } from '@/module/inventory/data/api';
import { useInventoryRelocationStore } from '@/module/inventory/model/relocation';
import type {
    InventoryDataSource,
    InventoryRelocationExecute,
} from '@/module/inventory/data/source';
import { HttpError, type HttpClient } from '@/platform/http';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const organizationId = id(1);
const body: InventoryRelocationExecute = {
    sourceFacilityId: id(2),
    sourceTopologyId: id(3),
    nodeId: id(4),
    targetFacilityId: id(5),
    targetTopologyId: id(6),
    parentId: null,
    expectedFingerprint: 'a'.repeat(64),
    confirmGovernanceChange: true,
    reason: 'Move freezer with its contents',
    idempotencyKey: 'original-key',
};
const receipt = {
    operationId: id(7),
    kind: 'inventory.relocate' as const,
    stockItemId: null,
    instanceId: null,
    nodeId: body.nodeId,
};
const preview = {
    fingerprint: 'a'.repeat(64),
    nodeCount: 2,
    itemCount: 1,
    workspaceIds: [id(8)],
    sourcePath: 'Room A / Freezer',
    targetPath: 'Room B / Freezer',
    sourceManagementWorkspaceId: id(8),
    targetManagementWorkspaceId: id(8),
    sourceAccessWorkspaceIds: [id(8)],
    targetAccessWorkspaceIds: [id(8)],
    items: [{ stockItemId: id(9), code: 'INS-1', workspaceId: id(8), quantity: '0.000000' }],
};

describe('container relocation HTTP adapter', () => {
    const input = {
        sourceFacilityId: body.sourceFacilityId,
        sourceTopologyId: body.sourceTopologyId,
        nodeId: body.nodeId,
        targetFacilityId: body.targetFacilityId,
        targetTopologyId: body.targetTopologyId,
        parentId: null,
    };
    function adapter(result: unknown) {
        const request = vi.fn().mockResolvedValue(result);
        return {
            request,
            source: createHttpInventoryDataSource({ request } as unknown as HttpClient),
        };
    }
    it('uses the organization preview route, original body and no automatic retries', async () => {
        const { request, source } = adapter(preview);
        expect(await source.previewRelocation(organizationId, input)).toEqual(preview);
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: `/organization/${organizationId}/inventory/container-relocation/preview`,
                body: input,
                retry: false,
            })
        );
    });
    it.each([
        { ...preview, itemCount: 2 },
        { ...preview, workspaceIds: [id(10)] },
        { ...preview, items: [...preview.items, ...preview.items], itemCount: 2 },
        { ...preview, fingerprint: 'not-a-fingerprint' },
    ])('rejects inconsistent impact responses', async (value) => {
        const { source } = adapter(value);
        await expect(source.previewRelocation(organizationId, input)).rejects.toMatchObject({
            kind: 'protocol',
        });
    });
    it('rejects a write receipt for another node', async () => {
        const { source } = adapter({ ...receipt, nodeId: id(99) });
        await expect(source.relocate(organizationId, body)).rejects.toMatchObject({
            kind: 'protocol',
        });
    });
    it('rejects a result lookup for another operation', async () => {
        const { source } = adapter({ ...receipt, operationId: id(99) });
        await expect(source.operation(organizationId, receipt.operationId)).rejects.toMatchObject({
            kind: 'protocol',
        });
    });
});

describe('container relocation recovery', () => {
    let pinia: Pinia;
    let relocate: ReturnType<typeof vi.fn>, operation: ReturnType<typeof vi.fn>;
    let source: InventoryDataSource;
    beforeEach(() => {
        sessionStorage.clear();
        pinia = createPinia();
        setActivePinia(pinia);
        relocate = vi.fn().mockResolvedValue(receipt);
        operation = vi.fn().mockResolvedValue(receipt);
        source = { relocate, operation } as unknown as InventoryDataSource;
    });
    afterEach(() => {
        vi.restoreAllMocks();
        disposePinia(pinia);
    });
    function store() {
        const value = useInventoryRelocationStore();
        value.connect(source, id(20));
        return value;
    }
    it('persists the exact command before dispatch and blocks another command', async () => {
        const value = store();
        relocate.mockImplementation(async () => {
            const saved = JSON.parse(
                sessionStorage.getItem(`talos.inventory.relocation.${id(20)}`)!
            );
            expect(saved[0].body).toEqual(body);
            return receipt;
        });
        await value.execute(organizationId, body);
        await value.execute(organizationId, { ...body, idempotencyKey: 'new-key' });
        expect(relocate).toHaveBeenCalledTimes(1);
        expect(value.current(organizationId)?.receipt).toEqual(receipt);
    });
    it('restores a response-loss attempt and replays only the original key and fingerprint', async () => {
        const value = store();
        relocate.mockRejectedValueOnce(new HttpError('lost response', 'network'));
        await value.execute(organizationId, body);
        disposePinia(pinia);
        pinia = createPinia();
        setActivePinia(pinia);
        const restored = store();
        await restored.recover(organizationId);
        expect(relocate).toHaveBeenLastCalledWith(organizationId, body, expect.any(AbortSignal));
        expect(restored.current(organizationId)?.receipt).toEqual(receipt);
    });
    it('a confirmed write uses only GET for synchronization recovery', async () => {
        const value = store();
        await value.execute(organizationId, body);
        await value.recover(organizationId);
        expect(relocate).toHaveBeenCalledTimes(1);
        expect(operation).toHaveBeenCalledWith(
            organizationId,
            receipt.operationId,
            expect.any(AbortSignal)
        );
        expect(value.acknowledge(organizationId)).toBe(true);
        expect(value.current(organizationId)).toBeUndefined();
    });
    it('a first 409 requires a fresh preview and retains no executable attempt', async () => {
        const value = store();
        relocate.mockRejectedValueOnce(new HttpError('stale preview', 'api', 409));
        await value.execute(organizationId, body);
        expect(value.current(organizationId)).toBeUndefined();
        expect(value.error).toContain('重新预览');
    });
    it('a recovery rejection cannot discard an operation with an unknown outcome', async () => {
        const value = store();
        relocate
            .mockRejectedValueOnce(new HttpError('lost response', 'network'))
            .mockRejectedValueOnce(new HttpError('permission revoked', 'api', 403));
        await value.execute(organizationId, body);
        await value.recover(organizationId);
        expect(value.current(organizationId)?.body).toEqual(body);
        expect(value.acknowledge(organizationId)).toBe(false);
    });
    it('does not send any write when durable recovery storage fails', async () => {
        const value = store();
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        await value.execute(organizationId, body);
        expect(relocate).not.toHaveBeenCalled();
        expect(value.recoveryError).toBeTruthy();
    });
    it('ignores late results after logout and clears the previous owner recovery state', async () => {
        const value = store();
        let resolve!: (value: typeof receipt) => void;
        relocate.mockImplementation(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        );
        const pending = value.execute(organizationId, body);
        value.connect(source, '');
        resolve(receipt);
        await pending;
        expect(value.attempts).toEqual([]);
        expect(value.busy).toBe(false);
        expect(sessionStorage.getItem(`talos.inventory.relocation.${id(20)}`)).toBeNull();
    });
    it('blocks writes if persisted recovery state is malformed', async () => {
        sessionStorage.setItem(`talos.inventory.relocation.${id(20)}`, '{broken');
        const value = store();
        await value.execute(organizationId, body);
        expect(value.recoveryError).toBeTruthy();
        expect(relocate).not.toHaveBeenCalled();
    });
});
