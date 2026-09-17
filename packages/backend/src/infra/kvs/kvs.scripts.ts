/**
 * 多条 Valkey 命令必须作为一个不可分割操作执行时使用的 Lua 脚本。
 *
 * 单条原生命令本身已经原子，不应为了形式统一而全部改用 Lua。
 */
export const kvsScripts = {
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
    hashGetAndDelete: `
        local value = redis.call('HGET', KEYS[1], ARGV[1])
        if value ~= false then
            redis.call('HDEL', KEYS[1], ARGV[1])
        end
        return value
    `,
    takeList: `
        local values = redis.call('LRANGE', KEYS[1], 0, -1)
        if #values > 0 then
            redis.call('DEL', KEYS[1])
        end
        return values
    `,
    takeSet: `
        local values = redis.call('SMEMBERS', KEYS[1])
        if #values > 0 then
            redis.call('DEL', KEYS[1])
        end
        return values
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
