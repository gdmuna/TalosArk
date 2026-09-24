import { createClient } from 'redis';

/**
 * `redis` 客户端使用 Redis 协议名，但 Valkey 部署配置可自然地写成
 * `valkey://` / `valkeys://`。两者在线路协议上兼容，因此仅在创建客户端时
 * 规范化 scheme，保留调用方原有的主机、认证和数据库配置。
 */
function normalizeKvsUrl(url: string): string {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol === 'valkey:') {
        parsedUrl.protocol = 'redis:';
    } else if (parsedUrl.protocol === 'valkeys:') {
        parsedUrl.protocol = 'rediss:';
    }

    return parsedUrl.toString();
}

export const createRedisClient = (url: string) => createClient({ url: normalizeKvsUrl(url) });

export type RedisClient = ReturnType<typeof createRedisClient>;
