import { Injectable } from '@nestjs/common';
import { InventoryActionSchema } from '@talos-ark/contracts/inventory';
import type { z } from 'zod';
import { InventoryActionService } from '../../../../src/modules/inventory/application/inventory-action.service.js';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import { inventoryHistoryKind } from './history.kind.js';
import { seedHash } from '../../definition/value.js';
import { type BusinessSeeder } from '../../runtime/handler.js';
import type { SeedExecution } from '../../runtime/execution.js';

@Injectable()
export class InventoryHistorySeeder implements BusinessSeeder<typeof inventoryHistoryKind> {
    constructor(
        private readonly actions: InventoryActionService,
        private readonly database: DatabaseRuntime
    ) {}
    async seed(
        data: z.output<typeof inventoryHistoryKind.data>,
        input: z.output<typeof inventoryHistoryKind.input>,
        execution: SeedExecution
    ) {
        const output: z.output<typeof inventoryHistoryKind.output> = [];
        for (const [index, item] of data.actions.entries()) {
            const stock = input.receipt.stocks[item.stockIndex];
            if (!stock) throw new Error(`Missing stock index ${item.stockIndex}`);
            output.push(
                await execution.record({
                    key: `action-${index}`,
                    output: inventoryHistoryKind.output.element,
                    create: async () => {
                        const current = await this.database.queryClient.stockItem.findUniqueOrThrow(
                            { where: { id: stock.stockItemId }, select: { version: true } }
                        );
                        const base = {
                            expectedVersion: current.version,
                            idempotencyKey: `seed:${seedHash([execution.namespace, execution.step, index])}`,
                        };
                        const makeRequest = (): z.input<typeof InventoryActionSchema> => {
                            const action = item.action;
                            switch (action.kind) {
                                case 'consume':
                                    return { kind: action.kind, body: { ...action.body, ...base } };
                                case 'adjust':
                                    return { kind: action.kind, body: { ...action.body, ...base } };
                                case 'dispose':
                                    return { kind: action.kind, body: { ...action.body, ...base } };
                                case 'transfer': {
                                    const nodeId = input.facility.positions[action.targetPosition];
                                    if (!nodeId) throw new Error('Missing transfer position');
                                    return {
                                        kind: action.kind,
                                        body: {
                                            ...action.body,
                                            ...base,
                                            position: {
                                                facilityId: input.facility.facilityId,
                                                topologyId: input.facility.topologyId,
                                                nodeId,
                                            },
                                        },
                                    };
                                }
                                default: {
                                    const unreachable: never = action;
                                    throw new Error(`Unsupported inventory action ${unreachable}`);
                                }
                            }
                        };
                        return this.actions.execute(
                            input.receipt.scope,
                            stock.stockItemId,
                            InventoryActionSchema.parse(makeRequest())
                        );
                    },
                    inspect: async (receipt) => ({
                        stock: await this.database.queryClient.stockItem.findUniqueOrThrow({
                            where: { id: stock.stockItemId },
                            include: { placement: true },
                        }),
                        operation:
                            await this.database.queryClient.inventoryOperation.findUniqueOrThrow({
                                where: { id: receipt.operationId },
                            }),
                        transactions: await this.database.queryClient.inventoryTransaction.findMany(
                            {
                                where: { operationId: receipt.operationId },
                                include: { lines: { orderBy: { lineNumber: 'asc' } } },
                                orderBy: { id: 'asc' },
                            }
                        ),
                    }),
                })
            );
        }
        return output;
    }
}
