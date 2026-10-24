import { type RedisClient } from '../redis.client.js';
import { parseStringArrayResult } from './result.js';

const listScripts = {
    getAndDelete: `
        local values = redis.call('LRANGE', KEYS[1], 0, -1)
        if #values > 0 then
            redis.call('DEL', KEYS[1])
        end
        return values
    `,
} as const;

export class KvsListAtomic {
    public constructor(private readonly client: RedisClient) {}

    /** 原子读取整个 List 后删除，保留原有顺序；key 不存在时返回空数组。 */
    public async getAndDelete(key: string): Promise<string[]> {
        const result = await this.client.eval(listScripts.getAndDelete, {
            keys: [key],
            arguments: [],
        });

        return parseStringArrayResult(result);
    }
}
