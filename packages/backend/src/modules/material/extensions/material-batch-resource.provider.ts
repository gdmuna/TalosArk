import { Injectable } from '@nestjs/common';
import {
    ResourceExtension,
    type ResourceProvider,
    type ResourceLookup,
} from '@/core/resource/index.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { materialPermission } from '../contribution/material-authorization.contribution.js';
@Injectable()
@ResourceExtension({ kind: 'MATERIAL_BATCH' })
export class MaterialBatchResourceProvider implements ResourceProvider {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly authorization: AuthorizationKernel
    ) {}
    async describe(input: ResourceLookup) {
        const row = await this.database.queryClient.materialBatch.findFirst({
            where: { resourceId: input.resourceId },
        });
        if (!row) return null;
        const decision = await this.authorization.check({
            subject: input.subject,
            target: { kind: 'material', id: row.materialId },
            permissionCode: materialPermission.read,
            expectedScope: input.expectedScope,
        });
        if (!decision.allowed) return null;
        return {
            resourceId: row.resourceId,
            kind: 'MATERIAL_BATCH' as const,
            objectId: row.id,
            scope: decision.context.scope,
            label: row.batchNumber,
            href: `/main/material/detail/${row.materialId}?batch=${row.id}`,
            archivedAt: row.archivedAt,
        };
    }
}
