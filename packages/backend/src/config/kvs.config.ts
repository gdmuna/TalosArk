import { ConfigType, registerAs } from '@nestjs/config';

import { z } from 'zod/v4';

const KvsConfigValidateSchema = z
    .object({
        KVS_URL: z.url(),
    })
    .transform((env) => ({
        kvsUrl: env.KVS_URL,
    }));

export const kvsConfig = registerAs('kvs', () => KvsConfigValidateSchema.parse(process.env));

export type KvsConfig = ConfigType<typeof kvsConfig>;
