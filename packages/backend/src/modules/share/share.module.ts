import { ShareController } from './share.controller.js';
import { ShareService } from './internal/share.service.js';
import { ShareRepository } from './internal/share.repository.js';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrgModule } from '@/modules/org/org.module.js';
import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule, OrgModule],
    controllers: [ShareController],
    providers: [ShareService, ShareRepository],
})
export class ShareModule {}
