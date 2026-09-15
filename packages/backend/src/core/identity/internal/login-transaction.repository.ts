import { DatabaseService } from '@/infra/database/database.service.js';

import { Injectable } from '@nestjs/common';

/** OIDC state / nonce / PKCE verifier 的短期服务端存储，仅供 IdentityKernel 使用。 */
@Injectable()
export class LoginTransactionRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    async create(data: {
        stateHash: string;
        nonce: string;
        pkceVerifier: string;
        expiresAt: Date;
    }) {
        const now = new Date();
        const [, transaction] = await this.databaseService.$transaction([
            this.databaseService.loginTransaction.deleteMany({
                where: { expiresAt: { lte: now } },
            }),
            this.databaseService.loginTransaction.create({ data }),
        ]);

        return transaction;
    }

    /**
     * 原子地领取一个仍有效的登录事务。
     * 同一个 state 的并发回调中，只有一个调用者能将其消费。
     */
    async consume(stateHash: string, now: Date) {
        const transaction = await this.databaseService.loginTransaction.findFirst({
            where: {
                stateHash,
                consumedAt: null,
                expiresAt: { gt: now },
            },
        });
        if (!transaction) return null;

        const result = await this.databaseService.loginTransaction.updateMany({
            where: { id: transaction.id, consumedAt: null },
            data: { consumedAt: now },
        });

        return result.count === 1 ? transaction : null;
    }
}
