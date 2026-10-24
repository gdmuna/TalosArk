import { Injectable } from '@nestjs/common';
import {
    InventoryActionSchema,
    type InventoryAction,
    type InventoryScope,
    type OperationReceipt,
} from '@talos-ark/contracts/inventory';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { IdempotencyKernel } from '@/core/idempotency/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { FacilityPositionReader } from '@/modules/facility/public/index.js';
import { planInventoryAction } from '../domain/inventory-action.js';
import {
    formatInventoryQuantity,
    parseInventoryQuantity,
} from '../domain/value-objects/inventory-quantity.js';
import { inventoryPermission as p } from '../contribution/inventory-authorization.contribution.js';
import { InventoryIdempotencyRepository } from '../infrastructure/persistence/inventory-idempotency.repository.js';
import { InventoryAccessService, inventoryScope } from './inventory-access.service.js';
import { InventoryOperationService, operationCodec } from './inventory-operation.service.js';
import { InventoryActionWriter } from './inventory-action.writer.js';
import { inventoryErrors } from './inventory.error.mapper.js';

@Injectable()
export class InventoryActionService {
    constructor(
        private readonly writes: OrganizationWriteKernel,
        private readonly access: InventoryAccessService,
        private readonly positions: FacilityPositionReader,
        private readonly reservations: InventoryIdempotencyRepository,
        private readonly idempotency: IdempotencyKernel,
        private readonly operations: InventoryOperationService,
        private readonly actor: AlsContextAdapter,
        private readonly writer: InventoryActionWriter
    ) {}

    private subject() {
        return { kind: 'user' as const, userId: this.actor.requireActor().userId };
    }

    execute(input: InventoryScope, stockItemId: string, request: InventoryAction) {
        const scope = inventoryScope(input);
        const command = InventoryActionSchema.parse(request);
        const kind = command.kind;
        const action: Parameters<typeof planInventoryAction>[1] =
            command.kind === 'consume'
                ? { kind: 'consume', quantity: parseInventoryQuantity(command.body.quantity) }
                : command.kind === 'adjust'
                  ? {
                        kind: 'adjust',
                        quantity: parseInventoryQuantity(command.body.actualQuantity),
                    }
                  : command.kind === 'transfer'
                    ? { kind: 'transfer' }
                    : { kind: 'dispose' };
        const normalized = {
            ...command.body,
            ...(action.kind === 'consume'
                ? { quantity: formatInventoryQuantity(action.quantity) }
                : {}),
            ...(action.kind === 'adjust'
                ? { actualQuantity: formatInventoryQuantity(action.quantity) }
                : {}),
        };
        const prepared = this.idempotency.prepare({
            scope: { kind: 'workspace', ...scope },
            operation: `inventory.${kind}`,
            key: command.body.idempotencyKey,
            payload: { actorUserId: this.subject().userId, stockItemId, ...normalized },
        });
        return inventoryErrors.run(() =>
            this.writes.run({
                organizationId: scope.organizationId,
                authorize: () => this.access.require(this.subject(), scope, p[kind]),
                execute: async () => {
                    const execution = await this.idempotency.run(
                        prepared,
                        async (): Promise<OperationReceipt> => {
                            const operation = await this.reservations.row(prepared);
                            return this.writer.write(scope, stockItemId, command, operation.id);
                        },
                        operationCodec
                    );
                    const operation = await this.operations.authorizeOperation(
                        scope.organizationId,
                        execution.value.operationId,
                        p[kind]
                    );
                    if (execution.kind === 'replayed' && kind !== 'adjust') {
                        const facilityIds = operation.transactions.flatMap((transaction) =>
                            transaction.lines.flatMap((line) =>
                                [line.fromFacilityIdSnapshot, line.toFacilityIdSnapshot].filter(
                                    (id): id is string => id !== null
                                )
                            )
                        );
                        await this.positions.requireUse(this.subject(), scope, facilityIds);
                    }
                    return this.operations.project(execution.value, operation);
                },
            })
        );
    }
}
