import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AllConfig } from '@/config/index.js';
import { IdentityKernel } from '@/core/identity/index.js';
import { AccessKernel } from '@/core/access/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { MailService } from '@/infra/mail/index.js';
import { MailError } from '@/infra/mail/mail.error.js';
import { defineErrorMapper } from '@/platform/error/error.mapper.js';
import { definedErrorId } from '@/platform/error/error.factory.js';
import type { PasswordRecoveryConfirmBody } from '@talos-ark/contracts/auth';
import { AuthError } from '../auth.error.js';
import { passwordRecoveryMail } from './password-recovery.mail.js';

const maxPending = 64;
const mapMailError = defineErrorMapper(MailError, AuthError, () => ({
    reason: 'unavailable' as const,
}));

@Injectable()
export class PasswordRecoveryService implements OnModuleDestroy {
    private readonly queue: string[] = [];
    private readonly active = new Map<AbortController, Promise<void>>();
    private readonly concurrency: number;
    private scheduled?: NodeJS.Immediate;
    private closed = false;

    constructor(
        private readonly identity: IdentityKernel,
        private readonly access: AccessKernel,
        private readonly database: DatabaseRuntime,
        private readonly mail: MailService,
        private readonly config: ConfigService<AllConfig, true>,
        @InjectPinoLogger(PasswordRecoveryService.name) private readonly logger: PinoLogger
    ) {
        this.concurrency = config.get('mail.maxConcurrentSends', { infer: true }) ?? 3;
    }

    /** No account lookup occurs on the HTTP acknowledgement path. This is not a durable queue. */
    enqueue(email: string): void {
        if (this.closed || this.queue.length + this.active.size >= maxPending)
            throw new AuthError({ reason: 'unavailable' }, { retryAfterSeconds: 60 });
        this.queue.push(email);
        if (!this.scheduled)
            this.scheduled = setImmediate(() => {
                this.scheduled = undefined;
                this.pump();
            });
    }

    async confirm(input: PasswordRecoveryConfirmBody): Promise<void> {
        const preparedPassword = await this.identity.preparePassword(input.password);
        await this.database.transaction.run(
            async () => {
                const { userId } = await this.identity.confirmPasswordRecovery({
                    token: input.token,
                    preparedPassword,
                });
                await this.access.revokeUserSessionAll({ userId });
            },
            { isolationLevel: 'ReadCommitted' }
        );
    }

    async onModuleDestroy(): Promise<void> {
        this.closed = true;
        this.queue.length = 0;
        if (this.scheduled) clearImmediate(this.scheduled);
        for (const controller of this.active.keys()) controller.abort();
        let timer: NodeJS.Timeout | undefined;
        try {
            await Promise.race([
                Promise.allSettled(this.active.values()),
                new Promise<void>((resolve) => {
                    timer = setTimeout(resolve, 2000);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    private pump(): void {
        while (!this.closed && this.queue.length && this.active.size < this.concurrency) {
            const email = this.queue.shift();
            if (email === undefined) break;
            const controller = new AbortController();
            const work = this.deliver(email, controller.signal).finally(() => {
                this.active.delete(controller);
                this.pump();
            });
            this.active.set(controller, work);
        }
    }

    private async deliver(email: string, signal: AbortSignal): Promise<void> {
        let credentialId: string | undefined;
        try {
            signal.throwIfAborted();
            const settings = this.config.get('auth.recovery', { infer: true });
            const issued = await this.identity.issuePasswordRecovery({
                email,
                expiresAt: new Date(Date.now() + settings.ttlSeconds * 1000),
            });
            if (!issued) return;
            credentialId = issued.id;
            signal.throwIfAborted();
            const url = new URL(settings.url);
            url.hash = new URLSearchParams({ token: issued.token }).toString();
            const result = await this.mail.sendMail(
                passwordRecoveryMail(issued.email, url.href, settings.ttlSeconds),
                { signal }
            );
            if (
                result.status !== 'accepted' ||
                result.accepted.length !== 1 ||
                result.rejected.length
            )
                throw new AuthError({ reason: 'unavailable' });
        } catch (error) {
            const failure = mapMailError(error) ?? error;
            let cleanupFailed = false;
            if (credentialId) {
                try {
                    await this.identity.revokePasswordRecovery(credentialId);
                } catch {
                    cleanupFailed = true;
                }
            }
            // This background boundary must never serialize a mail body, recipient or reset secret.
            this.logger.error(
                {
                    event: 'auth.recovery.failed',
                    errorId: definedErrorId(failure) ?? 'unexpected',
                    cleanupFailed,
                },
                'Password recovery delivery failed'
            );
        }
    }
}
