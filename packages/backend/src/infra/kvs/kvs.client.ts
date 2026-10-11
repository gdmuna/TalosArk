import { REDIS_CLIENT } from './kvs.constants.js';
import { type RedisClient } from './redis.client.js';
import { KvsHashAtomic } from './lua/hash.atomic.js';
import { KvsListAtomic } from './lua/list.atomic.js';
import { KvsSetAtomic } from './lua/set.atomic.js';
import { KvsStringAtomic } from './lua/string.atomic.js';

import { withKvsDeadline } from './kvs.timeout.js';
import { KvsError } from './kvs.error.js';
import { normalizeKvsError } from './kvs.error.normalize.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@/config/index.js';

/**
 * Valkey 的应用入口，负责客户端连接生命周期与按数据类型组织的原子 Lua 操作。
 *
 * 单命令操作直接通过 `redisClient` 调用；值的序列化由调用方决定。
 */
@Injectable()
export class KvsClient implements OnModuleInit, OnModuleDestroy {
    public readonly atomic: KvsStringAtomic;
    public readonly hAtomic: KvsHashAtomic;
    public readonly lAtomic: KvsListAtomic;
    public readonly sAtomic: KvsSetAtomic;
    private closing?: Promise<void>;

    public constructor(
        @Inject(REDIS_CLIENT) public readonly redisClient: RedisClient,
        @InjectPinoLogger(KvsClient.name) private readonly logger: PinoLogger,
        private readonly config: ConfigService<AllConfig, true>
    ) {
        this.atomic = new KvsStringAtomic(redisClient);
        this.hAtomic = new KvsHashAtomic(redisClient);
        this.lAtomic = new KvsListAtomic(redisClient);
        this.sAtomic = new KvsSetAtomic(redisClient);

        this.redisClient.on('error', (error) => {
            this.logger.error(
                {
                    event: 'kvs.connection.error',
                    operation: 'connection',
                    err: normalizeKvsError(error) ?? error,
                },
                'Valkey connection error'
            );
        });
    }

    /** 在 Nest 模块初始化时建立连接，使基础设施故障能尽早暴露。 */
    public async onModuleInit(): Promise<void> {
        if (!this.redisClient.isOpen) {
            try {
                await this.execute(() =>
                    withKvsDeadline(
                        () => this.redisClient.connect(),
                        this.config.get('kvs.connectTimeoutMs', { infer: true }),
                        new KvsError({ reason: 'connect-timeout' }),
                        () => this.redisClient.destroy()
                    )
                );
            } catch (cause) {
                this.redisClient.destroy();
                throw cause;
            }
        }
        this.logger.debug({ event: 'kvs.connected' }, 'KVS connected');
    }

    /** Pending commands drain within a budget; destroy rejects them on timeout. */
    public onModuleDestroy(): Promise<void> {
        return (this.closing ??= this.close());
    }

    private async close(): Promise<void> {
        if (!this.redisClient.isOpen) {
            this.redisClient.destroy();
            return;
        }
        try {
            await this.execute(() =>
                withKvsDeadline(
                    () => this.redisClient.close(),
                    this.config.get('kvs.closeTimeoutMs', { infer: true }),
                    new KvsError({ reason: 'close-timeout' }),
                    () => this.redisClient.destroy()
                )
            );
            this.logger.debug({ event: 'kvs.closed' }, 'KVS closed');
        } catch (error) {
            this.redisClient.destroy();
            if (!KvsError.is(error, 'close-timeout')) throw error;
            this.logger.warn(
                { event: 'kvs.close.timeout', err: error },
                'KVS close timed out; pending commands aborted'
            );
        }
    }

    public async execute<T>(operation: () => PromiseLike<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            throw normalizeKvsError(error) ?? error;
        }
    }
}
