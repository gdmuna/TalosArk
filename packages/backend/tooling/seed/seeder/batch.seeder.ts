import { Injectable } from '@nestjs/common';
import { BatchWriteSchema } from '@talos-ark/contracts/material';
import type { z } from 'zod';
import { MaterialBatchService } from '../../../src/modules/material/application/material-batch.service.js';
import { DatabaseRuntime } from '../../../src/infra/database/database.runtime.js';
import { batchKind } from './batch.kind.js';
import type { BusinessSeeder } from '../seed.definition.js';
import type { SeedExecution } from '../seed.execution.js';

@Injectable()
export class BatchSeeder implements BusinessSeeder<typeof batchKind> {
    constructor(
        private readonly batches: MaterialBatchService,
        private readonly database: DatabaseRuntime
    ) {}
    async seed(
        data: z.output<typeof batchKind.data>,
        input: z.output<typeof batchKind.input>,
        execution: SeedExecution
    ) {
        const output: z.output<typeof batchKind.output> = {};
        const materials = Object.values(input.materials);
        for (const item of data.batches) {
            const material = materials[item.materialIndex];
            if (!material) throw new Error(`Missing material index ${item.materialIndex}`);
            output[item.key] = await execution.record({
                key: item.key,
                output: batchKind.output.valueType,
                create: async () => {
                    const request = {
                        ...item.input,
                        batchNumber: `${execution.codePrefix}-${item.input.batchNumber}`,
                    } satisfies z.input<typeof BatchWriteSchema>;
                    let batch = await this.batches.create(
                        input.scope,
                        material.id,
                        BatchWriteSchema.parse(request)
                    );
                    if (item.archived)
                        batch = await this.batches.archive(input.scope, material.id, batch.id, {
                            expectedRevision: batch.revision,
                            archived: true,
                        });
                    return {
                        id: batch.id,
                        materialId: batch.materialId,
                        revision: batch.revision,
                        archivedAt: batch.archivedAt,
                    };
                },
                inspect: ({ id }) =>
                    this.database.queryClient.materialBatch.findUniqueOrThrow({
                        where: { id },
                        select: {
                            id: true,
                            materialId: true,
                            resourceId: true,
                            organizationId: true,
                            workspaceId: true,
                            batchNumber: true,
                            manufacturedOn: true,
                            expiryKind: true,
                            expiresOn: true,
                            notes: true,
                            revision: true,
                            archivedAt: true,
                        },
                    }),
            });
        }
        return output;
    }
}
