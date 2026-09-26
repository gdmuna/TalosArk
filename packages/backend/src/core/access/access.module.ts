import { AccessKernel } from './access.kernel.js';

import { PrismaModule } from '@/infra/database/prisma/prisma.module.js';
import { IamModule } from '@/infra/iam/index.js';
import { KvsModule } from '@/infra/kvs/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [PrismaModule, KvsModule, IamModule],
    providers: [AccessKernel],
    exports: [AccessKernel],
})
export class AccessModule {}
