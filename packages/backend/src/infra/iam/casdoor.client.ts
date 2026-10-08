import { SDK } from 'casdoor-nodejs-sdk';
import type { AxiosRequestConfig } from 'axios';

export type CasdoorSdkConfig = ConstructorParameters<typeof SDK>[0];

export function createCasdoorClient(
    config: CasdoorSdkConfig,
    transport: Pick<AxiosRequestConfig, 'adapter' | 'timeout'>
): SDK {
    return new SDK(config, transport);
}

export type CasdoorClient = ReturnType<typeof createCasdoorClient>;

export type CasdoorUser = ReturnType<CasdoorClient['parseJwtToken']>;
