import { Injectable } from '@nestjs/common';
import type { MaterialScope, BatchWrite } from '@talos-ark/contracts/material';
import type { PermissionSubject } from '@/core/permission/index.js';
import { MaterialBatchService } from '../application/material-batch.service.js';

export class MaterialReceiptError extends Error {
    constructor(readonly reason: 'archived' | 'stale-batch') {
        super(reason);
        this.name = 'MaterialReceiptError';
    }
}

@Injectable()
export class MaterialReceiptSource {
    constructor(private readonly batches: MaterialBatchService) {}
    async requireReceivableMaterial(subject: PermissionSubject, scope: MaterialScope, id: string) {
        const material = await this.batches.requireMaterial(subject, scope, id);
        if (material.archivedAt) throw new MaterialReceiptError('archived');
        return {
            id: material.id,
            quantityUnit: material.quantityUnit,
            quantityScale: material.quantityScale,
        };
    }
    async requireReceivableBatch(
        scope: MaterialScope,
        materialId: string,
        id: string,
        expectedRevision: number
    ) {
        const batch = await this.batches.requireBatch(scope, materialId, id);
        if (batch.archivedAt) throw new MaterialReceiptError('archived');
        if (batch.revision !== expectedRevision) throw new MaterialReceiptError('stale-batch');
        return batch.id;
    }
    async createBatch(
        subject: PermissionSubject,
        scope: MaterialScope,
        id: string,
        value: BatchWrite
    ) {
        const batch = await this.batches.createForReceipt(subject, scope, id, value);
        return batch.id;
    }
}
