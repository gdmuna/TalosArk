import { DatabaseService } from '@/infra/database/database.service.js';

import { Injectable } from '@nestjs/common';

/** TalosArk 自有刷新会话的持久化实现，仅供 IdentityKernel 使用。 */
@Injectable()
export class SessionRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    create(data: { id: string; userId: string; refreshTokenJti: string; expiresAt: Date }) {
        return this.databaseService.session.create({ data });
    }

    /**
     * 仅在旧 jti、用户、会话未撤销且未过期时轮换刷新令牌。
     * `updateMany` 使并发刷新只有一个请求能成功。
     */
    async rotate(data: {
        sessionId: string;
        userId: string;
        currentRefreshTokenJti: string;
        nextRefreshTokenJti: string;
        nextExpiresAt: Date;
        now: Date;
    }): Promise<boolean> {
        const result = await this.databaseService.session.updateMany({
            where: {
                id: data.sessionId,
                userId: data.userId,
                refreshTokenJti: data.currentRefreshTokenJti,
                revokedAt: null,
                expiresAt: { gt: data.now },
            },
            data: {
                refreshTokenJti: data.nextRefreshTokenJti,
                expiresAt: data.nextExpiresAt,
            },
        });

        return result.count === 1;
    }

    revoke(data: { sessionId: string; userId: string; refreshTokenJti: string; now: Date }) {
        return this.databaseService.session.updateMany({
            where: {
                id: data.sessionId,
                userId: data.userId,
                refreshTokenJti: data.refreshTokenJti,
                revokedAt: null,
            },
            data: { revokedAt: data.now },
        });
    }

    revokeAllForUser(userId: string, now: Date) {
        return this.databaseService.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: now },
        });
    }
}
