import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { ResourceModule } from '@/core/resource/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { MaterialController } from './api/material.controller.js';
import { MaterialService } from './application/material.service.js';
import { MaterialFactsReader } from './public/material-facts.reader.js';
import { MaterialTargetProvider } from './contribution/material-target.provider.js';
import { MaterialResourceProvider } from './extensions/material-resource.provider.js';

@Module({
    imports: [
        DatabaseModule,
        AuthorizationModule,
        PermissionModule,
        ResourceModule,
        AuditModule,
        PlatformContextModule,
    ],
    controllers: [MaterialController],
    providers: [
        MaterialService,
        MaterialFactsReader,
        MaterialTargetProvider,
        MaterialResourceProvider,
    ],
})
export class MaterialModule {}
