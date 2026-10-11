import { ConfigType, registerAs } from '@nestjs/config';

import { z } from 'zod/v4';

const KvsConfigValidateSchema = z
    .object({
        KVS_URL: z.url(),
        KVS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().max(60000).default(3000),
        KVS_CLOSE_TIMEOUT_MS: z.coerce.number().int().positive().max(60000).default(2000),
    })
    .transform((env) => ({
        kvsUrl: env.KVS_URL,
        connectTimeoutMs: env.KVS_CONNECT_TIMEOUT_MS,
        closeTimeoutMs: env.KVS_CLOSE_TIMEOUT_MS,
    }));

export const kvsConfig = registerAs('kvs', () => KvsConfigValidateSchema.parse(process.env));

export type KvsConfig = ConfigType<typeof kvsConfig>;
