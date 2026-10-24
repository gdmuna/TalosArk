import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { parseEnvironment } from './internal/config.validation.js';
import { ConfigurationError, configurationIssue } from '@/platform/error/error.validation.js';

export const AuthConfigSchema = z
    .object({
        AUTH_COOKIE_SECURE: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
        AUTH_ACTIVATION_URL: z.url().default('http://localhost:4444/auth/activate'),
        AUTH_ACTIVATION_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(86400),
        AUTH_RECOVERY_URL: z.url().default('http://localhost:4444/auth/reset-password'),
        AUTH_RECOVERY_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(1800),
        AUTH_RECOVERY_COOLDOWN_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
        AUTH_RECOVERY_WINDOW_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
        AUTH_RECOVERY_EMAIL_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
        AUTH_RECOVERY_IP_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
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
        recovery: {
            url: env.AUTH_RECOVERY_URL,
            ttlSeconds: env.AUTH_RECOVERY_TTL_SECONDS,
            cooldownSeconds: env.AUTH_RECOVERY_COOLDOWN_SECONDS,
            windowSeconds: env.AUTH_RECOVERY_WINDOW_SECONDS,
            emailLimit: env.AUTH_RECOVERY_EMAIL_LIMIT,
            ipLimit: env.AUTH_RECOVERY_IP_LIMIT,
        },
        firstPasswordSessionMaxAgeSeconds: env.AUTH_FIRST_PASSWORD_SESSION_MAX_AGE_SECONDS,
        attemptWindowSeconds: env.AUTH_ATTEMPT_WINDOW_SECONDS,
        accountAttemptLimit: env.AUTH_ACCOUNT_ATTEMPT_LIMIT,
        ipAttemptLimit: env.AUTH_IP_ATTEMPT_LIMIT,
    }));

export const authConfig = registerAs('auth', () => {
    const config = parseEnvironment(AuthConfigSchema, 'authentication');
    const activation = new URL(config.activationUrl);
    const recovery = new URL(config.recovery.url);
    if (
        !['http:', 'https:'].includes(recovery.protocol) ||
        recovery.username ||
        recovery.password ||
        recovery.search ||
        recovery.hash
    )
        throw new ConfigurationError('authentication environment', [
            configurationIssue(
                'AUTH_RECOVERY_URL',
                'an HTTP(S) URL without credentials, query or fragment',
                config.recovery.url
            ),
        ]);
    if (config.recovery.cooldownSeconds > config.recovery.windowSeconds)
        throw new ConfigurationError('authentication environment', [
            configurationIssue(
                'AUTH_RECOVERY_COOLDOWN_SECONDS',
                `<= AUTH_RECOVERY_WINDOW_SECONDS (${config.recovery.windowSeconds})`,
                config.recovery.cooldownSeconds,
                { scalar: true }
            ),
        ]);
    if (
        !['http:', 'https:'].includes(activation.protocol) ||
        activation.username ||
        activation.password ||
        activation.hash
    ) {
        throw new ConfigurationError('authentication environment', [
            configurationIssue(
                'AUTH_ACTIVATION_URL',
                'an HTTP(S) URL without credentials or fragment',
                config.activationUrl
            ),
        ]);
    }
    if (
        process.env.NODE_ENV === 'production' &&
        (!config.cookieSecure || activation.protocol !== 'https:' || recovery.protocol !== 'https:')
    ) {
        const issues = [];
        if (!config.cookieSecure)
            issues.push(
                configurationIssue(
                    'AUTH_COOKIE_SECURE',
                    'true when NODE_ENV=production',
                    config.cookieSecure,
                    { scalar: true }
                )
            );
        if (activation.protocol !== 'https:')
            issues.push(
                configurationIssue(
                    'AUTH_ACTIVATION_URL',
                    'an HTTPS URL when NODE_ENV=production',
                    config.activationUrl
                )
            );
        if (recovery.protocol !== 'https:')
            issues.push(
                configurationIssue(
                    'AUTH_RECOVERY_URL',
                    'an HTTPS URL when NODE_ENV=production',
                    config.recovery.url
                )
            );
        throw new ConfigurationError('authentication environment', issues);
    }
    return config;
});
export type AuthConfig = ConfigType<typeof authConfig>;
