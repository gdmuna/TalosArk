import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';
import type { MailMessage, MailSendOptions, MailSendResult } from './mail.contract.js';
import { MailError } from './mail.error.js';
import { MAIL_OPTIONS, resolveSmtpOptions, type MailModuleOptions } from './mail.options.js';
import { MailTransport } from './mail.transport.js';
import { mailboxSchema } from './mail.address.js';
import { validationDiagnostics } from '@/platform/error/error.validation.js';

const messageSchema = z
    .strictObject({
        to: z.union([mailboxSchema, z.array(mailboxSchema).min(1).max(50)]),
        subject: z
            .string()
            .min(1)
            .max(998)
            .regex(/^[^\r\n]+$/),
        text: z.string().optional(),
        html: z.string().optional(),
    })
    .refine((message) => !!message.text || !!message.html, { path: ['text'] });

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
    private readonly transport: MailTransport;

    constructor(
        @Inject(MAIL_OPTIONS) options: MailModuleOptions,
        @InjectPinoLogger(MailService.name) private readonly logger: PinoLogger
    ) {
        this.transport = new MailTransport(resolveSmtpOptions(options.options));
    }

    async onModuleInit(): Promise<void> {
        try {
            await this.verify();
        } catch (error) {
            if (!MailError.is(error)) throw error;
            this.logger.error(
                { event: 'mail.smtp.verification.failed', err: error },
                'SMTP startup verification failed; application startup will continue'
            );
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.transport.close();
        this.logger.debug({ event: 'mail.smtp.closed' }, 'SMTP resources closed');
    }

    /** Connects and authenticates without sending a message; does not prove sender acceptance. */
    async verify(): Promise<void> {
        const started = performance.now();
        await this.transport.verify();
        this.logger.info(
            { event: 'mail.smtp.verified', durationMs: performance.now() - started },
            'SMTP connection verified'
        );
    }

    async sendMail(message: MailMessage, options: MailSendOptions = {}): Promise<MailSendResult> {
        const input = messageSchema.safeParse(message, { reportInput: true });
        if (!input.success) {
            throw new MailError(
                {
                    reason: 'invalid-request',
                    operation: 'send',
                    phase: 'configuration',
                    outcome: 'not-sent',
                },
                {
                    validationIssues: validationDiagnostics(input.error, message, {
                        fields: {
                            to: {
                                expected: 'a valid mailbox, or an array of 1-50 valid mailboxes',
                            },
                            subject: {
                                hint: 'Provide a subject of 1-998 characters without CR/LF.',
                            },
                            text: { customExpected: 'nonempty text or html body' },
                            html: {},
                        },
                    }),
                }
            );
        }
        const started = performance.now();
        const result = await this.transport.send(input.data, options);
        this.logger.debug(
            {
                event: 'mail.smtp.accepted',
                status: result.status,
                acceptedCount: result.accepted.length,
                rejectedCount: result.rejected.length,
                durationMs: performance.now() - started,
            },
            'SMTP message accepted'
        );
        return result;
    }
}
