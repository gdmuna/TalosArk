import { createCasdoorClient } from './casdoor.client.js';
import { IamOidcAdapter } from './iam-oidc.adapter.js';
import { IamTokenAdapter } from './iam-token.adapter.js';
import { IamClient } from './iam.client.js';
import { CASDOOR_SDK } from './iam.constants.js';

import { AllConfig } from '@/config/index.js';
import { HttpModule } from '@/infra/http/http.module.js';
import { HttpClientFactory } from '@/infra/http/http-client.factory.js';

import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const casdoorSdkProvider: Provider = {
    provide: CASDOOR_SDK,
    inject: [ConfigService, HttpClientFactory],
    useFactory: (configService: ConfigService<AllConfig, true>, http: HttpClientFactory) => {
        const { sdkConfig } = configService.get('casdoor', { infer: true });

        return sdkConfig
            ? createCasdoorClient(sdkConfig, {
                  timeout: 60_000,
                  adapter: http.createAxiosAdapter({
                      name: 'casdoor-sdk',
                      baseUrl: `${sdkConfig.endpoint}/api`,
                      timeoutMs: 60_000,
                      retry: false,
                  }),
              })
            : undefined;
    },
};

@Module({
    imports: [HttpModule],
    providers: [casdoorSdkProvider, IamOidcAdapter, IamTokenAdapter, IamClient],
    exports: [IamClient],
})
export class IamModule {}
