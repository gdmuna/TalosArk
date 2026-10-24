import { Injectable } from '@nestjs/common';
import { ReceiptSchema } from '@talos-ark/contracts/inventory';
import type { z } from 'zod';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import { InventoryService } from '../../../../src/modules/inventory/application/inventory.service.js';
import { receiptKind } from './receipt.kind.js';
import type { SeedExecution } from '../../runtime/execution.js';
import { seedHash } from '../../definition/value.js';
import { type BusinessSeeder } from '../../runtime/handler.js';

@Injectable()
export class ReceiptSeeder implements BusinessSeeder<typeof receiptKind> {
    constructor(
        private readonly inventory: InventoryService,
        private readonly database: DatabaseRuntime
    ) {}

    async seed(
        data: z.infer<typeof receiptKind.data>,
        input: z.infer<typeof receiptKind.input>,
        execution: SeedExecution
    ): Promise<z.infer<typeof receiptKind.output>> {
        const { scope, materials } = input.materials;
        if (
            scope.organizationId !== input.facility.scope.organizationId ||
            scope.workspaceId !== input.facility.scope.workspaceId
        )
            throw new Error('Material and facility dataset scopes do not match');
        const entries = Object.entries(materials);
        if (entries.length > input.facility.positions.length)
            throw new Error('Receipt dataset needs one exclusive position per material');
        const stocks: z.infer<typeof receiptKind.output>['stocks'] = [];
        for (const [index, [key, material]] of entries.entries()) {
            stocks.push(
                await execution.record({
                    key: `receipt/${key}`,
                    output: receiptKind.output.shape.stocks.element,
                    create: async () => {
                        const request = {
                            ...data.facts[index % data.facts.length],
                            materialId: material.id,
                            code: `${execution.codePrefix}-${key}`,
                            quantity: data.quantity,
                            batch: { kind: 'none' },
                            expiry: data.facts[index % data.facts.length]?.expiry ?? {
                                kind: 'NONE',
                            },
                            confirmExpired: true,
                            position: {
                                facilityId: input.facility.facilityId,
                                topologyId: input.facility.topologyId,
                                nodeId: input.facility.positions[index],
                            },
                            idempotencyKey: `seed:${seedHash([execution.namespace, execution.step, key])}`,
                        } satisfies z.input<typeof ReceiptSchema>;
                        const batch = Object.values(input.batches).find(
                            (batch) => batch.materialId === material.id && !batch.archivedAt
                        );
                        const body = ReceiptSchema.parse(request);
                        if (batch)
                            body.batch = {
                                kind: 'existing',
                                id: batch.id,
                                expectedRevision: batch.revision,
                            };
                        const result = await this.inventory.receive(scope, body);
                        if (result.kind !== 'inventory.receive')
                            throw new Error('Inventory returned a different operation kind');
                        return {
                            stockItemId: result.stockItemId,
                            instanceId: result.instanceId,
                            operationId: result.operationId,
                        };
                    },
                    inspect: async ({ stockItemId, instanceId, operationId }) => {
                        const stock = await this.inventory.get(scope, stockItemId);
                        const {
                            expiryRisk: _risk,
                            actions: _actions,
                            capabilities: _capabilities,
                            ...content
                        } = stock;
                        const transactions =
                            await this.database.queryClient.inventoryTransaction.findMany({
                                where: { operationId },
                                orderBy: { id: 'asc' },
                                include: { lines: { orderBy: { lineNumber: 'asc' } } },
                            });
                        if (content.instanceId !== instanceId || !transactions.length)
                            throw new Error('Receipt references no longer match inventory');
                        return { stock: content, transactions };
                    },
                })
            );
        }
        return { scope, stocks };
    }
}
