import { OrgController } from './org.controller.js';
import { OrgUserController } from './org-user.controller.js';
import { OrgKernel } from './org.kernel.js';
import { OrgService } from './internal/org.service.js';
import { OrgUserService } from './internal/org-user.service.js';
import { OrgRepository } from './internal/org.repository.js';

import { DatabaseModule } from '@/infra/database/database.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule],
    controllers: [OrgController, OrgUserController],
    providers: [OrgService, OrgUserService, OrgRepository, OrgKernel],
    exports: [OrgKernel],
})
export class OrgModule {}
