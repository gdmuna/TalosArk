import { createCasdoorClient } from './casdoor.client.js';
import { IamOidcAdapter } from './iam-oidc.adapter.js';
import { IamTokenAdapter } from './iam-token.adapter.js';
import { IamClient } from './iam.client.js';
import { CASDOOR_SDK } from './iam.constants.js';

import { AllConfig } from '@/config/index.js';

import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const casdoorSdkProvider: Provider = {
    provide: CASDOOR_SDK,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<AllConfig, true>) => {
        const { sdkConfig } = configService.get('casdoor', { infer: true });

        return sdkConfig ? createCasdoorClient(sdkConfig) : undefined;
    },
};

@Module({
    providers: [casdoorSdkProvider, IamOidcAdapter, IamTokenAdapter, IamClient],
    exports: [IamClient],
})
export class IamModule {}
