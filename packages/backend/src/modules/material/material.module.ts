import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { OrganizationWriteModule } from '@/core/organization-write/index.js';
import { ResourceModule } from '@/core/resource/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { FileModule } from '@/core/file/index.js';
import { MaterialController } from './api/material.controller.js';
import { MaterialService } from './application/material.service.js';
import { MaterialFactsReader } from './public/material-facts.reader.js';
import { MaterialTargetProvider } from './contribution/material-target.provider.js';
import { MaterialResourceProvider } from './extensions/material-resource.provider.js';
import { MaterialFilePurposeProvider } from './extensions/material-file-purpose.provider.js';
import { MaterialBatchService } from './application/material-batch.service.js';
import { MaterialBatchController } from './api/material-batch.controller.js';
import { MaterialReceiptSource } from './public/material-receipt.source.js';
import { MaterialBatchResourceProvider } from './extensions/material-batch-resource.provider.js';
import { MaterialAttachmentController } from './api/material-attachment.controller.js';
import { MaterialAttachmentService } from './application/material-attachment.service.js';

@Module({
    imports: [
        DatabaseModule,
        AuthorizationModule,
        OrganizationWriteModule,
        PermissionModule,
        ResourceModule,
        AuditModule,
        PlatformContextModule,
        FileModule,
    ],
    controllers: [MaterialController, MaterialBatchController, MaterialAttachmentController],
    providers: [
        MaterialService,
        MaterialBatchService,
        MaterialAttachmentService,
        MaterialReceiptSource,
        MaterialBatchResourceProvider,
        MaterialFactsReader,
        MaterialTargetProvider,
        MaterialResourceProvider,
        MaterialFilePurposeProvider,
    ],
    exports: [MaterialFactsReader, MaterialReceiptSource],
})
export class MaterialModule {}
