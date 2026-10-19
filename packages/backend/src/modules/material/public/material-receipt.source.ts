import { Injectable } from '@nestjs/common';
import type { MaterialScope, BatchWrite } from '@talos-ark/contracts/material';
import type { PermissionSubject } from '@/core/permission/index.js';
import { MaterialBatchService } from '../application/material-batch.service.js';

@Injectable()
export class MaterialReceiptSource {
    constructor(private readonly batches: MaterialBatchService) {}
    requireMaterial(subject: PermissionSubject, scope: MaterialScope, id: string) {
        return this.batches.requireMaterial(subject, scope, id);
    }
    requireBatch(scope: MaterialScope, materialId: string, id: string) {
        return this.batches.requireBatch(scope, materialId, id);
    }
    createBatch(subject: PermissionSubject, scope: MaterialScope, id: string, value: BatchWrite) {
        return this.batches.createForReceipt(subject, scope, id, value);
    }
}
