import { type RedisClient } from '../redis.client.js';
import { parseStringArrayResult } from './result.js';

const setScripts = {
    getAndDelete: `
        local values = redis.call('SMEMBERS', KEYS[1])
        if #values > 0 then
            redis.call('DEL', KEYS[1])
        end
        return values
    `,
} as const;

export class KvsSetAtomic {
    public constructor(private readonly client: RedisClient) {}

    /** 原子读取整个 Set 后删除，成员顺序不保证；key 不存在时返回空数组。 */
    public async getAndDelete(key: string): Promise<string[]> {
        const result = await this.client.eval(setScripts.getAndDelete, {
            keys: [key],
            arguments: [],
        });

        return parseStringArrayResult(result);
    }
}
