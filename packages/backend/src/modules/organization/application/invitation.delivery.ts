import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { createHash } from 'node:crypto';
import type { AllConfig } from '@/config/index.js';
import { MailService } from '@/infra/mail/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import type { InvitationMail, InvitationMailDelivery } from './invitation-delivery.port.js';

export const invitationHash = (token: string) =>
    createHash('sha256').update(token).digest('base64url');

@Injectable()
export class InvitationDelivery implements InvitationMailDelivery, OnModuleDestroy {
    private readonly queue: InvitationMail[] = [];
    private readonly active = new Map<AbortController, Promise<void>>();
    private closed = false;
    constructor(
        private readonly mail: MailService,
        private readonly database: DatabaseRuntime,
        private readonly config: ConfigService<AllConfig, true>,
        @InjectPinoLogger(InvitationDelivery.name) private readonly logger: PinoLogger
    ) {}

    enqueue(item: InvitationMail): boolean {
        if (this.closed || this.queue.length + this.active.size >= 64) return false;
        this.queue.push(item);
        this.pump();
        return true;
    }

    private pump(): void {
        const concurrency = this.config.get('mail.maxConcurrentSends', { infer: true }) ?? 3;
        while (!this.closed && this.queue.length && this.active.size < concurrency) {
            const item = this.queue.shift();
            if (!item) break;
            const controller = new AbortController();
            const work = this.deliver(item, controller.signal).finally(() => {
                this.active.delete(controller);
                this.pump();
            });
            this.active.set(controller, work);
        }
    }

    private async deliver(item: InvitationMail, signal: AbortSignal): Promise<void> {
        try {
            signal.throwIfAborted();
            const current = await this.database.queryClient.organizationInvitation.findFirst({
                where: {
                    id: item.id,
                    tokenHash: invitationHash(item.token),
                    acceptedAt: null,
                    revokedAt: null,
                    expiresAt: { gt: new Date() },
                },
                select: { id: true },
            });
            if (!current) return;
            signal.throwIfAborted();
            const url = new URL(this.config.get('team.invitationUrl', { infer: true }));
            url.hash = new URLSearchParams({ token: item.token }).toString();
            const result = await this.mail.sendMail(
                {
                    to: item.email,
                    subject: '璇玑云库：组织邀请',
                    text: [
                        `你受邀加入组织「${item.organizationName}」。`,
                        '请使用被邀请邮箱对应的已有账户登录，并在有效期内打开以下链接确认加入：',
                        url.href,
                        '重发后旧链接失效。若非预期邀请，请忽略本邮件。',
                    ].join('\n\n'),
                },
                { signal }
            );
            if (
                result.status !== 'accepted' ||
                result.accepted.length !== 1 ||
                result.rejected.length
            )
                throw new Error('Invitation delivery not accepted');
        } catch {
            // Neither a recipient, credential, mail body nor vendor exception belongs in this log.
            this.logger.error(
                { event: 'team.invitation.delivery-failed', invitationId: item.id },
                'Invitation delivery failed; no automatic retry'
            );
        }
    }

    async onModuleDestroy(): Promise<void> {
        this.closed = true;
        this.queue.length = 0;
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
}
