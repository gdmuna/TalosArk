import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { FileModule } from '@/core/file/index.js';
import { MaterialController } from './api/material.controller.js';
import { MaterialCatalogModule } from './material-catalog.module.js';
import { MaterialFilePurposeProvider } from './extensions/material-file-purpose.provider.js';
import { MaterialBatchController } from './api/material-batch.controller.js';
import { MaterialAttachmentController } from './api/material-attachment.controller.js';
import { MaterialAttachmentService } from './application/material-attachment.service.js';

@Module({
    imports: [
        MaterialCatalogModule,
        DatabaseModule,
        AuthorizationModule,
        AuditModule,
        PlatformContextModule,
        FileModule,
    ],
    controllers: [MaterialController, MaterialBatchController, MaterialAttachmentController],
    providers: [MaterialAttachmentService, MaterialFilePurposeProvider],
    exports: [MaterialCatalogModule, MaterialAttachmentService],
})
export class MaterialModule {}
