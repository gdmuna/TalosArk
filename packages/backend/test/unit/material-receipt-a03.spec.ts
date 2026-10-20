import { InventoryErrorDefinition } from '@talos-ark/contracts/backend';
import { InventoryService } from '@/modules/inventory/application/inventory.service.js';
import { InventoryError } from '@/modules/inventory/application/inventory.error.js';
import { inventoryErrors } from '@/modules/inventory/application/inventory.error.mapper.js';
import { MaterialError } from '@/modules/material/application/material.error.js';
import { MaterialBatchService } from '@/modules/material/application/material-batch.service.js';
import {
    MaterialReceiptError,
    MaterialReceiptSource,
} from '@/modules/material/public/material-receipt.source.js';

const scope = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    workspaceId: '22222222-2222-4222-8222-222222222222',
};
const subject = { kind: 'user' as const, userId: '33333333-3333-4333-8333-333333333333' };
const materialId = '44444444-4444-4444-8444-444444444444';
const batchId = '55555555-5555-4555-8555-555555555555';

function source(stub: Record<string, unknown>) {
    return new MaterialReceiptSource(stub as unknown as MaterialBatchService);
}

describe('A03 Material receipt interface', () => {
    it('returns only receipt facts and preserves the material authorization call', async () => {
        const requireMaterial = vi.fn().mockResolvedValue({
            id: materialId,
            quantityUnit: 'mL',
            quantityScale: 3,
            archivedAt: null,
            internalField: 'hidden',
        });
        const result = await source({ requireMaterial }).requireReceivableMaterial(
            subject,
            scope,
            materialId
        );
        expect(result).toEqual({ id: materialId, quantityUnit: 'mL', quantityScale: 3 });
        expect(requireMaterial).toHaveBeenCalledWith(subject, scope, materialId);
    });

    it('preserves forbidden material failures', async () => {
        const forbidden = new MaterialError({ reason: 'forbidden' });
        await expect(
            source({
                requireMaterial: vi.fn().mockRejectedValue(forbidden),
            }).requireReceivableMaterial(subject, scope, materialId)
        ).rejects.toBe(forbidden);
    });

    it.each([
        [
            'archived material',
            { requireMaterial: vi.fn().mockResolvedValue({ archivedAt: new Date() }) },
            'state',
        ],
        [
            'archived batch',
            { requireBatch: vi.fn().mockResolvedValue({ archivedAt: new Date(), revision: 2 }) },
            'state',
        ],
        [
            'stale batch',
            { requireBatch: vi.fn().mockResolvedValue({ archivedAt: null, revision: 2 }) },
            'conflict',
        ],
    ] as const)('maps %s to the original inventory failure', async (_name, stub, reason) => {
        const receipt = source(stub);
        let failure: unknown;
        try {
            if ('requireMaterial' in stub)
                await receipt.requireReceivableMaterial(subject, scope, materialId);
            else await receipt.requireReceivableBatch(scope, materialId, batchId, 1);
        } catch (error) {
            failure = error;
        }
        expect(failure).toBeInstanceOf(MaterialReceiptError);
        const mapped = inventoryErrors.map(failure);
        expect(InventoryError.is(mapped, reason)).toBe(true);
        if (InventoryError.is(mapped)) {
            expect(mapped.details).toBeNull();
            expect(mapped.id).toBe(`inventory.${reason}`);
        }
        expect(InventoryErrorDefinition[reason].protocol.http.status).toBe(409);
    });

    it('returns a checked batch ID and keeps batch ownership lookup scoped', async () => {
        const requireBatch = vi.fn().mockResolvedValue({
            id: batchId,
            archivedAt: null,
            revision: 2,
            internalField: 'hidden',
        });
        expect(
            await source({ requireBatch }).requireReceivableBatch(scope, materialId, batchId, 2)
        ).toBe(batchId);
        expect(requireBatch).toHaveBeenCalledWith(scope, materialId, batchId);
    });

    it('returns only the created batch ID and preserves Material create errors', async () => {
        const value = { batchNumber: 'B-1' };
        const createForReceipt = vi
            .fn()
            .mockResolvedValue({ id: batchId, internalField: 'hidden' });
        expect(
            await source({ createForReceipt }).createBatch(
                subject,
                scope,
                materialId,
                value as never
            )
        ).toBe(batchId);
        expect(createForReceipt).toHaveBeenCalledWith(subject, scope, materialId, value);
        const archived = new MaterialError({ reason: 'archived' });
        expect(inventoryErrors.map(archived)).toBe(archived);
    });

    it('replays a completed receipt without rechecking material or batch state', async () => {
        const requireReceivableMaterial = vi.fn();
        const requireReceivableBatch = vi.fn();
        const authorizeOperation = vi.fn();
        const service = Object.assign(Object.create(InventoryService.prototype), {
            actor: { requireActor: () => ({ userId: subject.userId }) },
            access: { require: vi.fn() },
            writes: {
                run: async ({
                    authorize,
                    execute,
                }: {
                    authorize: () => Promise<void>;
                    execute: () => Promise<unknown>;
                }) => {
                    await authorize();
                    return execute();
                },
            },
            idempotency: {
                prepare: vi.fn().mockReturnValue({}),
                run: vi.fn().mockResolvedValue({
                    kind: 'replayed',
                    value: {
                        operationId: batchId,
                        kind: 'inventory.receive',
                        stockItemId: batchId,
                        instanceId: batchId,
                        nodeId: null,
                    },
                }),
            },
            materials: { requireReceivableMaterial, requireReceivableBatch },
            operations: { authorizeOperation },
        }) as InventoryService;
        await service.receive(scope, {
            materialId,
            quantity: '1',
            batch: { kind: 'existing', id: batchId, expectedRevision: 1 },
            position: { facilityId: materialId, topologyId: materialId, nodeId: materialId },
            idempotencyKey: 'a03-replay',
        } as never);
        expect(authorizeOperation).toHaveBeenCalledOnce();
        expect(requireReceivableMaterial).not.toHaveBeenCalled();
        expect(requireReceivableBatch).not.toHaveBeenCalled();
    });

    it.each([
        ['archived', new MaterialReceiptError('archived'), 'state'],
        ['precision', { id: materialId, quantityUnit: 'mL', quantityScale: 0 }, 'invalid'],
    ] as const)('checks %s before selecting a batch', async (_name, materialResult, reason) => {
        const requireReceivableBatch = vi.fn();
        const service = Object.assign(Object.create(InventoryService.prototype), {
            actor: { requireActor: () => ({ userId: subject.userId }) },
            access: { require: vi.fn() },
            writes: {
                run: async ({
                    authorize,
                    execute,
                }: {
                    authorize: () => Promise<void>;
                    execute: () => Promise<unknown>;
                }) => {
                    await authorize();
                    return execute();
                },
            },
            idempotency: {
                prepare: vi.fn().mockReturnValue({}),
                run: async (_prepared: unknown, execute: () => Promise<unknown>) => execute(),
            },
            reservations: { row: vi.fn().mockResolvedValue({ id: batchId }) },
            materials: {
                requireReceivableMaterial: vi
                    .fn()
                    .mockImplementation(() =>
                        materialResult instanceof Error
                            ? Promise.reject(materialResult)
                            : Promise.resolve(materialResult)
                    ),
                requireReceivableBatch,
            },
        }) as InventoryService;
        let failure: unknown;
        try {
            await service.receive(scope, {
                materialId,
                quantity: '1.5',
                batch: { kind: 'existing', id: batchId, expectedRevision: 1 },
                position: { facilityId: materialId, topologyId: materialId, nodeId: materialId },
                idempotencyKey: `a03-${reason}`,
            } as never);
        } catch (error) {
            failure = error;
        }
        expect(InventoryError.is(failure, reason)).toBe(true);
        expect(requireReceivableBatch).not.toHaveBeenCalled();
    });
});
