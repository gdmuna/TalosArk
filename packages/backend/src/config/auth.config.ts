import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';

export const AuthConfigSchema = z
    .object({
        AUTH_COOKIE_SECURE: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
        AUTH_ACTIVATION_URL: z.url().default('http://localhost:4444/auth/activate'),
        AUTH_ACTIVATION_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(86400),
        AUTH_FIRST_PASSWORD_SESSION_MAX_AGE_SECONDS: z.coerce
            .number()
            .int()
            .min(60)
            .max(3600)
            .default(600),
        AUTH_ATTEMPT_WINDOW_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
        AUTH_ACCOUNT_ATTEMPT_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
        AUTH_IP_ATTEMPT_LIMIT: z.coerce.number().int().min(1).max(1000).default(30),
    })
    .transform((env) => ({
        cookieSecure: env.AUTH_COOKIE_SECURE,
        activationUrl: env.AUTH_ACTIVATION_URL,
        activationTtlSeconds: env.AUTH_ACTIVATION_TTL_SECONDS,
        firstPasswordSessionMaxAgeSeconds: env.AUTH_FIRST_PASSWORD_SESSION_MAX_AGE_SECONDS,
        attemptWindowSeconds: env.AUTH_ATTEMPT_WINDOW_SECONDS,
        accountAttemptLimit: env.AUTH_ACCOUNT_ATTEMPT_LIMIT,
        ipAttemptLimit: env.AUTH_IP_ATTEMPT_LIMIT,
    }));

export const authConfig = registerAs('auth', () => {
    const config = AuthConfigSchema.parse(process.env);
    const activation = new URL(config.activationUrl);
    if (
        !['http:', 'https:'].includes(activation.protocol) ||
        activation.username ||
        activation.password ||
        activation.hash
    ) {
        throw new Error('AUTH_ACTIVATION_URL must be an HTTP URL without credentials or fragment');
    }
    if (
        process.env.NODE_ENV === 'production' &&
        (!config.cookieSecure || activation.protocol !== 'https:')
    ) {
        throw new Error(
            'Production authentication requires Secure cookies and an HTTPS activation URL'
        );
    }
    return config;
});
export type AuthConfig = ConfigType<typeof authConfig>;
