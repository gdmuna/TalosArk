import { type RedisClient } from '../redis.client.js';

const stringScripts = {
    getAndDelete: `
        local value = redis.call('GET', KEYS[1])
        if value ~= false then
            redis.call('DEL', KEYS[1])
        end
        return value
    `,
    compareAndDelete: `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
        end
        return 0
    `,
    incrementWithInitialExpiry: `
        local exists = redis.call('EXISTS', KEYS[1])
        local value = redis.call('INCRBY', KEYS[1], ARGV[1])
        if exists == 0 then
            redis.call('EXPIRE', KEYS[1], ARGV[2])
        end
        return value
    `,
} as const;

export class KvsStringAtomic {
    public constructor(private readonly client: RedisClient) {}

    /** 原子读取字符串值后删除该 key。 */
    public async getAndDelete(key: string): Promise<string | null> {
        const result = await this.client.eval(stringScripts.getAndDelete, {
            keys: [key],
            arguments: [],
        });

        return typeof result === 'string' ? result : null;
    }

    /** 仅在值匹配时删除，适用于安全释放带 token 的锁。 */
    public async compareAndDelete(key: string, expectedValue: string): Promise<boolean> {
        const result = await this.client.eval(stringScripts.compareAndDelete, {
            keys: [key],
            arguments: [expectedValue],
        });

        return result === 1;
    }

    /** 自增计数器；只在 key 首次创建时设置过期时间。 */
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

        const result = await this.client.eval(stringScripts.incrementWithInitialExpiry, {
            keys: [key],
            arguments: [String(increment), String(expiresInSeconds)],
        });

        if (typeof result !== 'number') {
            throw new Error('Valkey increment script returned a non-numeric result.');
        }

        return result;
    }
}
