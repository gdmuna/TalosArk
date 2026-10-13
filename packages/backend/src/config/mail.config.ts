import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';

const optionalBoolean = z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true'));
const optionalTimeout = z.coerce.number().int().min(1).max(120_000).optional();
const schema = z
    .object({
        SMTP_HOST: z.string().default(''),
        SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(465),
        SMTP_SECURE: optionalBoolean,
        SMTP_REQUIRE_TLS: optionalBoolean,
        SMTP_SERVERNAME: z.string().optional(),
        SMTP_USER: z.string().optional(),
        SMTP_PASS: z.string().optional(),
        SMTP_FROM: z.string().default(''),
        SMTP_CONNECTION_TIMEOUT_MS: optionalTimeout,
        SMTP_GREETING_TIMEOUT_MS: optionalTimeout,
        SMTP_SOCKET_TIMEOUT_MS: optionalTimeout,
        SMTP_DNS_TIMEOUT_MS: optionalTimeout,
        SMTP_SEND_TIMEOUT_MS: optionalTimeout,
        SMTP_CLOSE_TIMEOUT_MS: optionalTimeout,
        SMTP_MAX_CONCURRENT_SENDS: z.coerce.number().int().min(1).max(20).optional(),
    })
    .transform((env) => ({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
        requireTLS: env.SMTP_REQUIRE_TLS,
        servername: env.SMTP_SERVERNAME || undefined,
        user: env.SMTP_USER || undefined,
        pass: env.SMTP_PASS || undefined,
        from: env.SMTP_FROM,
        connectionTimeoutMs: env.SMTP_CONNECTION_TIMEOUT_MS,
        greetingTimeoutMs: env.SMTP_GREETING_TIMEOUT_MS,
        socketTimeoutMs: env.SMTP_SOCKET_TIMEOUT_MS,
        dnsTimeoutMs: env.SMTP_DNS_TIMEOUT_MS,
        sendTimeoutMs: env.SMTP_SEND_TIMEOUT_MS,
        closeTimeoutMs: env.SMTP_CLOSE_TIMEOUT_MS,
        maxConcurrentSends: env.SMTP_MAX_CONCURRENT_SENDS,
    }));

export const mailConfig = registerAs('mail', () => schema.parse(process.env));
export type MailConfig = ConfigType<typeof mailConfig>;

export default mailConfig;
