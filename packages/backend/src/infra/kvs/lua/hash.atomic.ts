import { type RedisClient } from '../redis.client.js';
import { parseStringArrayResult } from './result.js';

const hashScripts = {
    getAndDelete: `
        local fields = redis.call('HGETALL', KEYS[1])
        if #fields > 0 then
            redis.call('DEL', KEYS[1])
        end
        return fields
    `,
    getFieldAndDelete: `
        local value = redis.call('HGET', KEYS[1], ARGV[1])
        if value ~= false then
            redis.call('HDEL', KEYS[1], ARGV[1])
        end
        return value
    `,
} as const;

export class KvsHashAtomic {
    public constructor(private readonly client: RedisClient) {}

    /** 原子读取整个 Hash 后删除；key 不存在时返回空对象。 */
    public async getAllAndDelete(key: string): Promise<Record<string, string>> {
        const result = await this.client.eval(hashScripts.getAndDelete, {
            keys: [key],
            arguments: [],
        });
        const fields = parseStringArrayResult(result);
        if (fields.length % 2 !== 0) {
            throw new TypeError('Lua script returned an invalid hash field array.');
        }

        const hash: Record<string, string> = Object.create(null);
        for (let index = 0; index < fields.length; index += 2) {
            const field = fields[index];
            const value = fields[index + 1];
            if (field === undefined || value === undefined) {
                throw new TypeError('Lua script returned an invalid hash field array.');
            }
            hash[field] = value;
        }

        return hash;
    }

    /** 原子读取并删除单个 Hash field。 */
    public async getFieldAndDelete(key: string, field: string): Promise<string | null> {
        const result = await this.client.eval(hashScripts.getFieldAndDelete, {
            keys: [key],
            arguments: [field],
        });

        return typeof result === 'string' ? result : null;
    }
}
