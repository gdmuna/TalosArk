import { NodeController } from './node.controller.js';
import { NodeService } from './internal/node.service.js';
import { NodeRepository } from './internal/node.repository.js';

import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrgModule } from '@/modules/org/org.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule, OrgModule],
    controllers: [NodeController],
    providers: [NodeService, NodeRepository],
})
export class NodeModule {}
