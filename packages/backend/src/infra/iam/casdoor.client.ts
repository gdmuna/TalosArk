import { SDK } from 'casdoor-nodejs-sdk';

export type CasdoorSdkConfig = ConstructorParameters<typeof SDK>[0];

export function createCasdoorClient(config: CasdoorSdkConfig): SDK {
    return new SDK(config);
}

export type CasdoorClient = ReturnType<typeof createCasdoorClient>;
