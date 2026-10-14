import { HttpModule } from '@/infra/http/http.module.js';
import { HttpClientFactory } from '@/infra/http/http-client.factory.js';
import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { CasdoorOidcClient } from './casdoor/casdoor.oidc-client.js';
import type { IamModuleOptions, IamModuleAsyncOptions } from './iam.options.js';

const IAM_OPTIONS = Symbol('IAM_OPTIONS');

@Module({})
export class IamModule {
    static forRootAsync(options: IamModuleAsyncOptions): DynamicModule {
        return {
            module: IamModule,
            global: true,
            imports: [HttpModule, ...(options.imports ?? [])],
            providers: this.createProviders({
                provide: IAM_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject ?? [],
            }),
            exports: [CasdoorOidcClient],
        };
    }

    private static createProviders(optionsProvider: Provider): Provider[] {
        return [
            optionsProvider,
            {
                provide: CasdoorOidcClient,
                inject: [IAM_OPTIONS, HttpClientFactory],
                useFactory: ({ options }: IamModuleOptions, http: HttpClientFactory) =>
                    new CasdoorOidcClient(options, http),
            },
        ];
    }
}
