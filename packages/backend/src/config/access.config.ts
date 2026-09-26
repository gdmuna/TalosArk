import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod/v4';

const AccessConfigSchema = z.object({
    JWT_ACCESS_PRIVATE_KEY: z.string().trim().optional(),
    JWT_ACCESS_PUBLIC_KEY: z.string().trim().optional(),
    JWT_ACCESS_EXPIRES_IN: z
        .string()
        .regex(/^[1-9]\d*(?:s|m|h|d)$/)
        .default('15m'),
});

const secondsPerUnit = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 } as const;

export const accessConfig = registerAs('access', () => {
    const environment = AccessConfigSchema.parse(process.env);
    const duration = environment.JWT_ACCESS_EXPIRES_IN;
    const unit = duration.at(-1) as keyof typeof secondsPerUnit;
    const accessTokenTtlSeconds = Number(duration.slice(0, -1)) * secondsPerUnit[unit];
    if (!Number.isSafeInteger(accessTokenTtlSeconds)) {
        throw new RangeError('JWT_ACCESS_EXPIRES_IN must be a safe integer number of seconds');
    }

    return {
        privateKey: environment.JWT_ACCESS_PRIVATE_KEY?.replace(/\\n/g, '\n') || undefined,
        publicKey: environment.JWT_ACCESS_PUBLIC_KEY?.replace(/\\n/g, '\n') || undefined,
        accessTokenTtlSeconds,
    };
});

export type AccessConfig = ConfigType<typeof accessConfig>;
