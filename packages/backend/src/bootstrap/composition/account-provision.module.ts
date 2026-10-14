import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import allConfig from '@/config/index.js';
import { AuthModule } from '@/modules/auth/auth.module.js';
import { IamModule } from '@/infra/iam/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { PlatformLoggerModule } from '@/platform/observability/logger/logger.module.js';
import { loggerOptions } from './logger.provider.js';
import { iamOptions } from './infra.composition.js';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: allConfig }),
        PlatformLoggerModule.forRoot(loggerOptions),
        IamModule.forRootAsync(iamOptions),
        PlatformContextModule,
        AuthModule,
    ],
})
export class AccountProvisionModule {}
