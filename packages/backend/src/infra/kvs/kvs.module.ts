import { createKvsClient } from './kvs.client.js';
import { KVS_CLIENT } from './kvs.constants.js';
import { KvsService } from './kvs.service.js';

import { type AllConfig } from '@/config/index.js';

import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const kvsClientProvider: Provider = {
    provide: KVS_CLIENT,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<AllConfig, true>) => {
        const { kvsUrl } = configService.get('kvs', { infer: true });

        return createKvsClient(kvsUrl);
    },
};

/** Valkey（Redis 协议）基础设施模块；由需要 KVS 的业务模块显式导入。 */
@Module({
    providers: [kvsClientProvider, KvsService],
    exports: [KvsService],
})
export class KvsModule {}
