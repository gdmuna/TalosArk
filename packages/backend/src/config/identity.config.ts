import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { parseEnvironment } from './internal/config.validation.js';

export const IdentityConfigSchema = z
    .object({
        IDENTITY_PASSWORD_HASH_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
    })
    .transform((env) => ({ passwordHashConcurrency: env.IDENTITY_PASSWORD_HASH_CONCURRENCY }));

export const identityConfig = registerAs('identity', () =>
    parseEnvironment(IdentityConfigSchema, 'identity')
);
export type IdentityConfig = ConfigType<typeof identityConfig>;
