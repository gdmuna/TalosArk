import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import type { scopeSchema } from '../../definition/reference.js';

@Injectable()
export class StockFactsReader {
    constructor(private readonly database: DatabaseRuntime) {}

    read(scope: z.output<typeof scopeSchema>, stockItemIds: readonly string[]) {
        return this.database.queryClient.stockItem.findMany({
            where: {
                organizationId: scope.organizationId,
                workspaceId: scope.workspaceId,
                id: { in: [...new Set(stockItemIds)] },
            },
            select: {
                id: true,
                instanceId: true,
                quantity: true,
                status: true,
                placement: { select: { storageNodeId: true } },
            },
        });
    }
}
