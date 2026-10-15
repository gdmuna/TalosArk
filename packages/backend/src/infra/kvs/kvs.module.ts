import { KvsClient } from './kvs.client.js';
import { REDIS_CLIENT } from './kvs.constants.js';
import { createRedisClient } from './redis.client.js';

import { type AllConfig } from '@/config/index.js';

import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerExtension } from '@/platform/observability/logger/logger-contribution.decorator.js';
import { kvsLogContribution } from './kvs.log.contribution.js';

const redisClientProvider: Provider = {
    provide: REDIS_CLIENT,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<AllConfig, true>) => {
        const { kvsUrl, connectTimeoutMs } = configService.get('kvs', { infer: true });

        return createRedisClient(kvsUrl, connectTimeoutMs);
    },
};

/** Valkey（Redis 协议）基础设施模块；由需要 KVS 的业务模块显式导入。 */
@LoggerExtension(kvsLogContribution)
@Module({
    providers: [redisClientProvider, KvsClient],
    exports: [KvsClient],
})
export class KvsModule {}
