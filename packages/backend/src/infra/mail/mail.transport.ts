import SMTPConnection from 'nodemailer/lib/smtp-connection';
import MailComposer from 'nodemailer/lib/mail-composer';
import type { Readable } from 'node:stream';
import type { MailMessage, MailSendOptions, MailSendResult } from './mail.contract.js';
import { MailError, type MailPhase } from './mail.error.js';
import { mailOutcome, normalizeMailError } from './mail.error.normalize.js';
import type { ResolvedSmtpOptions } from './mail.options.js';

interface Operation {
    done: Promise<unknown>;
    abort(): void;
}

/** Owns SDK connections so a deadline actually stops work, rather than only rejecting a promise. */
export class MailTransport {
    private readonly active = new Set<Operation>();
    private closing?: Promise<void>;

    constructor(private readonly options: ResolvedSmtpOptions) {}

    verify(): Promise<void> {
        return this.run(undefined, {});
    }

    send(message: MailMessage, options: MailSendOptions): Promise<MailSendResult> {
        return this.run(message, options);
    }

    close(): Promise<void> {
        if (!this.closing) this.closing = this.drain();
        return this.closing;
    }

    private async drain(): Promise<void> {
        let timer: NodeJS.Timeout | undefined;
        const drained = Promise.allSettled([...this.active].map((operation) => operation.done));
        try {
            const finished = await Promise.race([
                drained.then(() => true),
                new Promise<false>((resolve) => {
                    timer = setTimeout(() => resolve(false), this.options.closeTimeoutMs);
                }),
            ]);
            if (finished) return;
            for (const operation of this.active) operation.abort();
            await drained;
            throw new MailError({
                reason: 'close-timeout',
                operation: 'close',
                phase: 'close',
                outcome: 'unknown',
            });
        } finally {
            clearTimeout(timer);
        }
    }

    private run(message: undefined, options: MailSendOptions): Promise<void>;
    private run(message: MailMessage, options: MailSendOptions): Promise<MailSendResult>;
    private run(
        message: MailMessage | undefined,
        options: MailSendOptions
    ): Promise<MailSendResult | void> {
        const operation = message ? 'send' : 'verify';
        const signal = options.signal;
        const failure = (reason: 'closed' | 'busy' | 'cancelled' | 'timeout', phase: MailPhase) =>
            new MailError({ reason, operation, phase, outcome: mailOutcome(phase) });
        if (this.closing) return Promise.reject(failure('closed', 'connect'));
        if (signal?.aborted) return Promise.reject(failure('cancelled', 'connect'));
        if (this.active.size >= this.options.maxConcurrentSends) {
            return Promise.reject(failure('busy', 'connect'));
        }
        const deferred = Promise.withResolvers<MailSendResult | void>();
        const connection = new SMTPConnection({
            host: this.options.host,
            port: this.options.port,
            secure: this.options.secure,
            requireTLS: this.options.requireTLS,
            servername: this.options.servername,
            connectionTimeout: this.options.connectionTimeoutMs,
            greetingTimeout: this.options.greetingTimeoutMs,
            socketTimeout: this.options.socketTimeoutMs,
            dnsTimeout: this.options.dnsTimeoutMs,
            tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
            logger: false,
            debug: false,
            transactionLog: false,
        });
        let phase: MailPhase = 'connect';
        let settled = false;
        let stream: Readable | undefined;
        const onAbort = () => finish(failure('cancelled', phase));
        const pending: Operation = {
            done: deferred.promise,
            abort: () => finish(failure('closed', phase)),
        };
        const finish = (error?: unknown, result?: MailSendResult) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            const socket = connection._socket;
            connection.close();
            // SDK close() ends an established socket; destruction also bounds half-open teardown.
            if (socket) socket.destroy();
            stream?.destroy();
            this.active.delete(pending);
            if (error !== undefined)
                deferred.reject(normalizeMailError(error, operation, phase) ?? error);
            else deferred.resolve(result);
        };
        const send = () => {
            if (settled) return;
            if (!message) return finish();
            try {
                const mime = new MailComposer({
                    from: this.options.from,
                    to: typeof message.to === 'string' ? message.to : [...message.to],
                    subject: message.subject,
                    text: message.text,
                    html: message.html,
                    disableFileAccess: true,
                    disableUrlAccess: true,
                }).compile();
                const messageId = mime.messageId();
                stream = mime.createReadStream();
                phase = 'send';
                connection.send(mime.getEnvelope(), stream, (error, info) => {
                    if (settled) return;
                    if (error) return finish(error);
                    if (!info || !info.accepted.length) {
                        return finish(
                            new MailError({
                                reason: 'invalid-response',
                                operation,
                                phase,
                                outcome: 'unknown',
                            })
                        );
                    }
                    finish(undefined, {
                        status: info.rejected.length ? 'partial' : 'accepted',
                        messageId,
                        accepted: [...info.accepted],
                        rejected: [...info.rejected],
                    });
                });
            } catch (error) {
                finish(error);
            }
        };
        this.active.add(pending);
        connection.once('error', (error) => finish(error));
        connection.once('end', () =>
            finish(
                new MailError({
                    reason: 'unavailable',
                    operation,
                    phase,
                    outcome: mailOutcome(phase),
                })
            )
        );
        signal?.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(
            () => finish(failure('timeout', phase)),
            this.options.sendTimeoutMs
        );
        try {
            connection.connect((error) => {
                if (settled) return;
                if (error) return finish(error);
                if (!this.options.user) return send();
                phase = 'authenticate';
                connection.login({ user: this.options.user, pass: this.options.pass }, (error) => {
                    if (settled) return;
                    if (error) return finish(error);
                    send();
                });
            });
        } catch (error) {
            finish(error);
        }
        return deferred.promise;
    }
}
