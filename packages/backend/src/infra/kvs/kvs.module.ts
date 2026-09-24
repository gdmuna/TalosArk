import { KvsClient } from './kvs.client.js';
import { REDIS_CLIENT } from './kvs.constants.js';
import { createRedisClient } from './redis.client.js';

import { type AllConfig } from '@/config/index.js';

import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const redisClientProvider: Provider = {
    provide: REDIS_CLIENT,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<AllConfig, true>) => {
        const { kvsUrl } = configService.get('kvs', { infer: true });

        return createRedisClient(kvsUrl);
    },
};

/** Valkey（Redis 协议）基础设施模块；由需要 KVS 的业务模块显式导入。 */
@Module({
    providers: [redisClientProvider, KvsClient],
    exports: [KvsClient],
})
export class KvsModule {}
