import { CASDOOR_SDK } from './casdoor.constant.js';
import { CasdoorOidcClient } from './casdoor-oidc.client.js';
import { createCasdoorSdk } from './casdoor-sdk.js';

import { AllConfig } from '@/config/index.js';

import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 根据当前环境配置创建 Casdoor SDK 的 Nest 提供者。 */
const casdoorSdkProvider: Provider = {
    provide: CASDOOR_SDK,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<AllConfig, true>) => {
        const { sdkConfig } = configService.get('casdoor', { infer: true });

        return sdkConfig ? createCasdoorSdk(sdkConfig) : undefined;
    },
};

/**
 * Casdoor 平台级基础设施模块。
 *
 * IdentityKernel 按需导入本模块以使用 OIDC。Casbin/Casdoor 策略管理适配器不在这里
 * 导出；未来仅由平台管理用例显式装配，业务模块不得将其作为授权边界。
 */
@Module({
    providers: [casdoorSdkProvider, CasdoorOidcClient],
    exports: [CasdoorOidcClient],
})
export class CasdoorModule {}
