import { PrismaService } from './prisma.service.js';

import { PlatformContextModule } from '@/platform/context/context.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [PlatformContextModule],
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule {}
