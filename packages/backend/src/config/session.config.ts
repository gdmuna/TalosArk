import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod/v4';
import { parseEnvironment } from './internal/config.validation.js';
import { ConfigurationError, configurationIssue } from '@/platform/error/error.validation.js';

const SessionConfigSchema = z.object({
    JWT_ACCESS_PRIVATE_KEY: z.string().trim().optional(),
    JWT_ACCESS_PUBLIC_KEY: z.string().trim().optional(),
    JWT_ACCESS_EXPIRES_IN: z
        .string()
        .regex(/^[1-9]\d*(?:s|m|h|d)$/)
        .default('15m'),
});

const secondsPerUnit = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 } as const;

export const sessionConfig = registerAs('session', () => {
    const environment = parseEnvironment(SessionConfigSchema, 'session', {
        fields: {
            JWT_ACCESS_EXPIRES_IN: { expected: 'a positive duration using s/m/h/d, e.g. 15m' },
        },
    });
    const duration = environment.JWT_ACCESS_EXPIRES_IN;
    const unit = duration.at(-1) as keyof typeof secondsPerUnit;
    const accessTokenTtlSeconds = Number(duration.slice(0, -1)) * secondsPerUnit[unit];
    if (!Number.isSafeInteger(accessTokenTtlSeconds)) {
        throw new ConfigurationError('session environment', [
            configurationIssue(
                'JWT_ACCESS_EXPIRES_IN',
                'a duration representable as a safe integer number of seconds',
                duration
            ),
        ]);
    }

    return {
        privateKey: environment.JWT_ACCESS_PRIVATE_KEY?.replace(/\\n/g, '\n') || undefined,
        publicKey: environment.JWT_ACCESS_PUBLIC_KEY?.replace(/\\n/g, '\n') || undefined,
        accessTokenTtlSeconds,
    };
});

export type SessionConfig = ConfigType<typeof sessionConfig>;
