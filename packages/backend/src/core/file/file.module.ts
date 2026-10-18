import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrganizationContextModule } from '@/core/organization-context/index.js';
import { FileKernel } from './file.kernel.js';
import { FileRepository } from './internal/file.repository.js';
import { FileOperations } from './internal/file.operation.js';
import { UploadSessionService } from './services/upload-session.service.js';
import { FileReadinessService } from './services/file-readiness.service.js';
import { FileCleanupService } from './services/file-cleanup.service.js';

@Module({
    imports: [DatabaseModule, OrganizationContextModule],
    providers: [
        FileKernel,
        FileRepository,
        FileOperations,
        UploadSessionService,
        FileReadinessService,
        FileCleanupService,
    ],
    exports: [FileKernel],
})
export class FileModule {}
