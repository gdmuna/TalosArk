import { IdentityKernel } from './identity.kernel.js';
import type { AllConfig } from '@/config/index.js';

import { DatabaseModule } from '@/infra/database/database.module.js';
import { IamModule } from '@/infra/iam/index.js';
import { KvsModule } from '@/infra/kvs/index.js';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
    imports: [
        DatabaseModule,
        KvsModule,
        IamModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService<AllConfig, true>) => {
                const { oidc, sdkConfig } = config.get('casdoor', { infer: true });
                return {
                    options: {
                        ...oidc,
                        organization: sdkConfig.orgName,
                        application: sdkConfig.appName,
                    },
                };
            },
        }),
    ],
    providers: [IdentityKernel],
    exports: [IdentityKernel],
})
export class IdentityModule {}
