import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrganizationContextModule } from '@/core/organization-context/index.js';
import { SystemAccessModule } from '@/core/system-access/index.js';
import { ExtensionDiscoveryModule } from '@/platform/extensions/discovery/index.js';
import { FileKernel } from './file.kernel.js';
import { FileRepository } from './internal/file.repository.js';
import { FileOperations } from './internal/file.operation.js';
import { UploadSessionService } from './services/upload-session.service.js';
import { FileReadinessService } from './services/file-readiness.service.js';
import { FileCleanupService } from './services/file-cleanup.service.js';
import { FileBindingService } from './services/file-binding.service.js';
import { FilePurposeRegistry } from './purpose/file-purpose.registry.js';
import { FilePurposePolicy } from './purpose/file-purpose.policy.js';

@Module({
    imports: [
        DatabaseModule,
        OrganizationContextModule,
        SystemAccessModule,
        ExtensionDiscoveryModule,
    ],
    providers: [
        FileKernel,
        FileRepository,
        FileOperations,
        UploadSessionService,
        FileReadinessService,
        FileCleanupService,
        FileBindingService,
        FilePurposeRegistry,
        FilePurposePolicy,
    ],
    exports: [FileKernel],
})
export class FileModule {}
