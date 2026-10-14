import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import { z } from 'zod';
import { MailError } from './mail.error.js';
import { mailboxSchema } from './mail.address.js';
import { validationDiagnostics } from '@/platform/error/error.validation.js';

export const MAIL_OPTIONS = Symbol('MAIL_OPTIONS');

export interface SmtpOptions {
    host: string;
    port?: number;
    secure?: boolean;
    /** Require STARTTLS when not using implicit TLS. Disable only for a trusted relay. */
    requireTLS?: boolean;
    servername?: string;
    user?: string;
    pass?: string;
    from: string;
    connectionTimeoutMs?: number;
    greetingTimeoutMs?: number;
    socketTimeoutMs?: number;
    dnsTimeoutMs?: number;
    /** Whole operation deadline, including connection, authentication and DATA. */
    sendTimeoutMs?: number;
    closeTimeoutMs?: number;
    maxConcurrentSends?: number;
}

export interface MailModuleOptions {
    options: SmtpOptions;
}

export interface MailModuleAsyncOptions {
    useFactory: FactoryProvider<MailModuleOptions>['useFactory'];
    imports?: ModuleMetadata['imports'];
    inject?: FactoryProvider<MailModuleOptions>['inject'];
}

const timeout = (fallback: number) => z.number().int().min(1).max(120_000).default(fallback);
const schema = z
    .strictObject({
        host: z
            .string()
            .trim()
            .min(1)
            .max(255)
            .regex(/^[^\s/\\]+$/),
        port: z.number().int().min(1).max(65_535).default(465),
        secure: z.boolean().default(true),
        requireTLS: z.boolean().default(true),
        servername: z.string().trim().min(1).max(255).optional(),
        user: z.string().min(1).optional(),
        pass: z.string().min(1).optional(),
        from: mailboxSchema,
        connectionTimeoutMs: timeout(15_000),
        greetingTimeoutMs: timeout(10_000),
        socketTimeoutMs: timeout(15_000),
        dnsTimeoutMs: timeout(5_000),
        sendTimeoutMs: timeout(30_000),
        closeTimeoutMs: timeout(2_000),
        maxConcurrentSends: z.number().int().min(1).max(20).default(3),
    })
    .refine((options) => !!options.user === !!options.pass, { path: ['pass'] })
    .refine((options) => options.port !== 465 || options.secure, { path: ['secure'] })
    .refine((options) => !options.user || options.secure || options.requireTLS, {
        path: ['requireTLS'],
    });

export type ResolvedSmtpOptions = Readonly<z.output<typeof schema>>;

export function resolveSmtpOptions(options: SmtpOptions): ResolvedSmtpOptions {
    const input = {
        ...options,
        secure: options?.secure ?? (options?.port ?? 465) === 465,
    };
    const result = schema.safeParse(input, { reportInput: true });
    if (!result.success) {
        const fields = {
            host: {
                label: 'host (SMTP_HOST)',
                expected: 'a hostname or IP without whitespace, protocol or path',
            },
            port: { label: 'port (SMTP_PORT)', scalar: true },
            secure: {
                label: 'secure (SMTP_SECURE)',
                scalar: true,
                customExpected: 'true when SMTP_PORT=465',
                hint: 'Use implicit TLS on 465; for STARTTLS on 587 set secure=false and requireTLS=true.',
            },
            requireTLS: {
                label: 'requireTLS (SMTP_REQUIRE_TLS)',
                scalar: true,
                customExpected:
                    'SMTP_SECURE=true or SMTP_REQUIRE_TLS=true when SMTP_USER is configured',
                hint: 'Enable STARTTLS with SMTP_REQUIRE_TLS=true, or use implicit TLS. Authentication over plaintext is not allowed.',
            },
            servername: { label: 'servername (SMTP_SERVERNAME)' },
            user: { label: 'user (SMTP_USER)' },
            pass: {
                label: 'pass (SMTP_PASS)',
                customExpected: 'SMTP_USER and SMTP_PASS configured together, or both absent',
                hint: 'Provide both credentials; omit both only for a trusted unauthenticated relay.',
            },
            from: {
                label: 'from (SMTP_FROM)',
                customExpected: 'a single valid mailbox without header newlines',
            },
            connectionTimeoutMs: {
                label: 'connectionTimeoutMs (SMTP_CONNECTION_TIMEOUT_MS)',
                scalar: true,
            },
            greetingTimeoutMs: {
                label: 'greetingTimeoutMs (SMTP_GREETING_TIMEOUT_MS)',
                scalar: true,
            },
            socketTimeoutMs: { label: 'socketTimeoutMs (SMTP_SOCKET_TIMEOUT_MS)', scalar: true },
            dnsTimeoutMs: { label: 'dnsTimeoutMs (SMTP_DNS_TIMEOUT_MS)', scalar: true },
            sendTimeoutMs: { label: 'sendTimeoutMs (SMTP_SEND_TIMEOUT_MS)', scalar: true },
            closeTimeoutMs: { label: 'closeTimeoutMs (SMTP_CLOSE_TIMEOUT_MS)', scalar: true },
            maxConcurrentSends: {
                label: 'maxConcurrentSends (SMTP_MAX_CONCURRENT_SENDS)',
                scalar: true,
            },
        };
        // Retain safe constraints, not the original error, credentials or configuration object.
        throw new MailError(
            {
                reason: 'configuration',
                operation: 'configure',
                phase: 'configuration',
                outcome: 'not-sent',
                invalidFields: Object.freeze([
                    ...new Set(
                        result.error.issues.map((issue) =>
                            typeof issue.path[0] === 'string' &&
                            Object.hasOwn(schema.shape, issue.path[0])
                                ? issue.path[0]
                                : 'options'
                        )
                    ),
                ]),
            },
            { validationIssues: validationDiagnostics(result.error, input, { fields }) }
        );
    }
    return Object.freeze(result.data);
}
