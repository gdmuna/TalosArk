import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import allConfig from '@/config/index.js';
import { AuthModule } from '@/modules/auth/auth.module.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { PlatformLoggerModule } from '@/platform/observability/logger/logger.module.js';
import { loggerOptions } from './logger.provider.js';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: allConfig }),
        PlatformLoggerModule.forRoot(loggerOptions),
        PlatformContextModule,
        AuthModule,
    ],
})
export class AccountProvisionModule {}
