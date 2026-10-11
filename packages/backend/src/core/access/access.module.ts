import { AccessKernel } from './access.kernel.js';

import { PrismaModule } from '@/infra/database/prisma/prisma.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [PrismaModule],
    providers: [AccessKernel],
    exports: [AccessKernel],
})
export class AccessModule {}
