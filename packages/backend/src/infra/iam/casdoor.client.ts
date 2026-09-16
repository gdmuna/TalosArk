import { SDK } from 'casdoor-nodejs-sdk';

/** Casdoor SDK 所需的平台级连接配置。 */
export type CasdoorSdkConfig = ConstructorParameters<typeof SDK>[0];

/** 使用已验证的配置创建 Casdoor SDK 实例。 */
export function createCasdoorClient(config: CasdoorSdkConfig): SDK {
    return new SDK(config);
}
