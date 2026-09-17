import { KVS_CLIENT } from './kvs.constants.js';
import { type KvsClient } from './kvs.client.js';
import { kvsScripts } from './kvs.scripts.js';

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export type KvsSetCondition = 'if-not-exists' | 'if-exists';

export interface KvsSetOptions {
    condition?: KvsSetCondition;
    expiresInSeconds?: number;
}

/**
 * Valkey 的应用语义入口。
 *
 * 基础操作保持为 Valkey 的单命令调用；`atomic` 仅承载必须跨命令执行的 Lua 操作。
 * 值以字符串传递，序列化与业务对象的版本策略由调用方决定。
 */
@Injectable()
export class KvsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KvsService.name);

    public readonly key: KvsKeyOperations;
    public readonly hash: KvsHashOperations;
    public readonly list: KvsListOperations;
    public readonly set: KvsSetOperations;
    public readonly atomic: KvsAtomicOperations;

    public constructor(@Inject(KVS_CLIENT) private readonly client: KvsClient) {
        this.key = new KvsKeyOperations(client);
        this.hash = new KvsHashOperations(client);
        this.list = new KvsListOperations(client);
        this.set = new KvsSetOperations(client);
        this.atomic = new KvsAtomicOperations(client);

        this.client.on('error', (error) => {
            this.logger.error(error, 'Valkey client error');
        });
    }

    /** 在 Nest 模块初始化时建立连接，使基础设施故障能尽早暴露。 */
    public async onModuleInit(): Promise<void> {
        if (!this.client.isOpen) {
            await this.client.connect();
        }
    }

    /** 进程正常关闭时关闭连接，不向业务代码泄露客户端生命周期。 */
    public async onModuleDestroy(): Promise<void> {
        if (this.client.isOpen) {
            await this.client.close();
        }
    }
}

class KvsKeyOperations {
    public constructor(private readonly client: KvsClient) {}

    public get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    public async set(key: string, value: string, options: KvsSetOptions = {}): Promise<boolean> {
        const result = await this.client.set(key, value, {
            ...(options.expiresInSeconds === undefined ? {} : { EX: options.expiresInSeconds }),
            ...(options.condition === 'if-not-exists' ? { NX: true } : {}),
            ...(options.condition === 'if-exists' ? { XX: true } : {}),
        });

        return result === 'OK';
    }

    public delete(...keys: string[]): Promise<number> {
        return keys.length === 0 ? Promise.resolve(0) : this.client.del(keys);
    }

    public exists(...keys: string[]): Promise<number> {
        return keys.length === 0 ? Promise.resolve(0) : this.client.exists(keys);
    }

    public async expire(key: string, seconds: number): Promise<boolean> {
        return (await this.client.expire(key, seconds)) === 1;
    }

    public ttl(key: string): Promise<number> {
        return this.client.ttl(key);
    }
}

class KvsHashOperations {
    public constructor(private readonly client: KvsClient) {}

    public get(key: string, field: string): Promise<string | null> {
        return this.client.hGet(key, field);
    }

    public set(key: string, field: string, value: string): Promise<number> {
        return this.client.hSet(key, field, value);
    }

    public getAll(key: string): Promise<Record<string, string>> {
        return this.client.hGetAll(key);
    }

    public delete(key: string, ...fields: string[]): Promise<number> {
        return fields.length === 0 ? Promise.resolve(0) : this.client.hDel(key, fields);
    }

    public async exists(key: string, field: string): Promise<boolean> {
        return (await this.client.hExists(key, field)) === 1;
    }

    public incrementBy(key: string, field: string, increment: number): Promise<number> {
        return this.client.hIncrBy(key, field, increment);
    }
}

class KvsListOperations {
    public constructor(private readonly client: KvsClient) {}

    public pushLeft(key: string, ...values: string[]): Promise<number> {
        return values.length === 0 ? Promise.resolve(0) : this.client.lPush(key, values);
    }

    public pushRight(key: string, ...values: string[]): Promise<number> {
        return values.length === 0 ? Promise.resolve(0) : this.client.rPush(key, values);
    }

    public popLeft(key: string): Promise<string | null> {
        return this.client.lPop(key);
    }

    public popRight(key: string): Promise<string | null> {
        return this.client.rPop(key);
    }

    public range(key: string, start = 0, stop = -1): Promise<string[]> {
        return this.client.lRange(key, start, stop);
    }

    public length(key: string): Promise<number> {
        return this.client.lLen(key);
    }
}

class KvsSetOperations {
    public constructor(private readonly client: KvsClient) {}

    public add(key: string, ...members: string[]): Promise<number> {
        return members.length === 0 ? Promise.resolve(0) : this.client.sAdd(key, members);
    }

    public remove(key: string, ...members: string[]): Promise<number> {
        return members.length === 0 ? Promise.resolve(0) : this.client.sRem(key, members);
    }

    public members(key: string): Promise<string[]> {
        return this.client.sMembers(key);
    }

    public async has(key: string, member: string): Promise<boolean> {
        return (await this.client.sIsMember(key, member)) === 1;
    }

    public cardinality(key: string): Promise<number> {
        return this.client.sCard(key);
    }
}

class KvsAtomicOperations {
    public constructor(private readonly client: KvsClient) {}

    /** 原子读取字符串值后删除该 key。 */
    public async getAndDelete(key: string): Promise<string | null> {
        const result = await this.client.eval(kvsScripts.getAndDelete, {
            keys: [key],
            arguments: [],
        });

        return typeof result === 'string' ? result : null;
    }

    /** 仅在值匹配时删除，适用于安全释放带 token 的锁。 */
    public async compareAndDelete(key: string, expectedValue: string): Promise<boolean> {
        const result = await this.client.eval(kvsScripts.compareAndDelete, {
            keys: [key],
            arguments: [expectedValue],
        });

        return result === 1;
    }

    /** 原子读取 Hash field 后删除该 field。 */
    public async hashGetAndDelete(key: string, field: string): Promise<string | null> {
        const result = await this.client.eval(kvsScripts.hashGetAndDelete, {
            keys: [key],
            arguments: [field],
        });

        return typeof result === 'string' ? result : null;
    }

    /** 原子取走 List 全部元素，并删除该 list。 */
    public async takeList(key: string): Promise<string[]> {
        const result = await this.client.eval(kvsScripts.takeList, {
            keys: [key],
            arguments: [],
        });

        return asStringArray(result);
    }

    /** 原子取走 Set 全部成员，并删除该 set。 */
    public async takeSet(key: string): Promise<string[]> {
        const result = await this.client.eval(kvsScripts.takeSet, {
            keys: [key],
            arguments: [],
        });

        return asStringArray(result);
    }

    /**
     * 自增计数器；只在 key 首次创建时设置过期时间。
     *
     * 适用于固定窗口限流、一次性额度等不能因重复写入而延长窗口的场景。
     */
    public async incrementWithInitialExpiry(
        key: string,
        expiresInSeconds: number,
        increment = 1
    ): Promise<number> {
        if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0) {
            throw new TypeError('expiresInSeconds must be a positive safe integer.');
        }

        if (!Number.isSafeInteger(increment)) {
            throw new TypeError('increment must be a safe integer.');
        }

        const result = await this.client.eval(kvsScripts.incrementWithInitialExpiry, {
            keys: [key],
            arguments: [String(increment), String(expiresInSeconds)],
        });

        if (typeof result !== 'number') {
            throw new Error('Valkey increment script returned a non-numeric result.');
        }

        return result;
    }
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];
}
