import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';
import type { MailMessage, MailSendOptions, MailSendResult } from './mail.contract.js';
import { MailError } from './mail.error.js';
import { MAIL_OPTIONS, resolveSmtpOptions, type MailModuleOptions } from './mail.options.js';
import { MailTransport } from './mail.transport.js';
import { mailboxSchema } from './mail.address.js';

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
    .refine((message) => !!message.text || !!message.html);

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
        await this.verify();
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
        const input = messageSchema.safeParse(message);
        if (!input.success) {
            throw new MailError({
                reason: 'invalid-request',
                operation: 'send',
                phase: 'configuration',
                outcome: 'not-sent',
            });
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
