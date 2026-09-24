import { REDIS_CLIENT } from './kvs.constants.js';
import { type RedisClient } from './redis.client.js';
import { KvsHashAtomic } from './lua/hash.atomic.js';
import { KvsListAtomic } from './lua/list.atomic.js';
import { KvsSetAtomic } from './lua/set.atomic.js';
import { KvsStringAtomic } from './lua/string.atomic.js';

import { timeout } from '@/common/utils/index.js';

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * Valkey 的应用入口，负责客户端连接生命周期与按数据类型组织的原子 Lua 操作。
 *
 * 单命令操作直接通过 `redisClient` 调用；值的序列化由调用方决定。
 */
@Injectable()
export class KvsClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KvsClient.name);

    public readonly atomic: KvsStringAtomic;
    public readonly hAtomic: KvsHashAtomic;
    public readonly lAtomic: KvsListAtomic;
    public readonly sAtomic: KvsSetAtomic;

    public constructor(@Inject(REDIS_CLIENT) public readonly redisClient: RedisClient) {
        this.atomic = new KvsStringAtomic(redisClient);
        this.hAtomic = new KvsHashAtomic(redisClient);
        this.lAtomic = new KvsListAtomic(redisClient);
        this.sAtomic = new KvsSetAtomic(redisClient);

        this.redisClient.on('error', (error) => {
            this.logger.error(error, 'Valkey client error');
        });
    }

    /** 在 Nest 模块初始化时建立连接，使基础设施故障能尽早暴露。 */
    public async onModuleInit(): Promise<void> {
        if (!this.redisClient.isOpen) {
            await timeout(this.redisClient.connect(), 3000, 'KVS Connect Timeout');
        }
        this.logger.debug('KVS connected');
    }

    /** 进程正常关闭时关闭连接。 */
    public async onModuleDestroy(): Promise<void> {
        if (this.redisClient.isOpen) {
            await this.redisClient.close();
        }
    }
}
