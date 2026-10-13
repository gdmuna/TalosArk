import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import { z } from 'zod';
import { MailError } from './mail.error.js';
import { mailboxSchema } from './mail.address.js';

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
    imports?: ModuleMetadata['imports'];
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
    const result = schema.safeParse({
        ...options,
        secure: options?.secure ?? (options?.port ?? 465) === 465,
    });
    if (!result.success) {
        // Invalid configuration can contain credentials; do not attach the input or Zod error.
        throw new MailError({
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
        });
    }
    return Object.freeze(result.data);
}
