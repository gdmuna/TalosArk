import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { OrganizationWriteModule } from '@/core/organization-write/index.js';
import { ResourceModule } from '@/core/resource/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { MaterialService } from './application/material.service.js';
import { MaterialBatchService } from './application/material-batch.service.js';
import { MaterialFactsReader } from './public/material-facts.reader.js';
import { MaterialReceiptSource } from './public/material-receipt.source.js';
import { MaterialTargetProvider } from './contribution/material-target.provider.js';
import { MaterialResourceProvider } from './extensions/material-resource.provider.js';
import { MaterialBatchResourceProvider } from './extensions/material-batch-resource.provider.js';

/** Catalog and batch capabilities also serve tools and inventory without file storage. */
@Module({
    imports: [
        DatabaseModule,
        AuthorizationModule,
        OrganizationWriteModule,
        ResourceModule,
        AuditModule,
        PermissionModule,
        PlatformContextModule,
    ],
    providers: [
        MaterialService,
        MaterialBatchService,
        MaterialFactsReader,
        MaterialReceiptSource,
        MaterialTargetProvider,
        MaterialResourceProvider,
        MaterialBatchResourceProvider,
    ],
    exports: [MaterialService, MaterialBatchService, MaterialFactsReader, MaterialReceiptSource],
})
export class MaterialCatalogModule {}
