import type * as Access from './access.contract.js';

import type { AllConfig } from '@/config/index.js';
import { createSecureRandomString } from '@/common/utils/index.js';

import { PrismaService } from '@/infra/database/prisma/prisma.service.js';
import { KvsClient } from '@/infra/kvs/index.js';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPrivateKey, type KeyObject } from 'node:crypto';
import { SignJWT } from 'jose';
import { v7 as uuidv7 } from 'uuid';

const ACCESS_TOKEN_ISSUER = 'talos-ark';
const ACCESS_TOKEN_AUDIENCE = 'talos-ark-api';
const ACCESS_TOKEN_ALGORITHM = 'ES256';
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AccessKernel {
    private signingKey?: KeyObject;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly kvsClient: KvsClient,
        private readonly configService: ConfigService<AllConfig, true>
    ) {}

    async createUserSession(
        input: Access.CreateUserSessionInput
    ): Promise<Access.CreateUserSessionOutput> {
        const config = this.configService.get('access', { infer: true });
        if (!config.privateKey || !config.publicKey) {
            throw new Error('JWT_ACCESS_PRIVATE_KEY and JWT_ACCESS_PUBLIC_KEY must be configured');
        }

        const signingKey = (this.signingKey ??= createPrivateKey(config.privateKey));

        const now = Date.now();
        const sessionId = uuidv7();
        const familyId = uuidv7();
        const accessTokenId = uuidv7();
        const sessionVersion = 1;
        const sessionIdleExpiresAt = new Date(now + 30 * DAY_MS);
        const refreshTokenExpiresAt = new Date(now + 7 * DAY_MS);
        const accessTokenIssuedAtSeconds = Math.floor(now / 1000);
        const accessTokenExpiresAtSeconds = Math.floor(
            Math.min(
                now + config.accessTokenTtlSeconds * 1000,
                sessionIdleExpiresAt.getTime(),
                refreshTokenExpiresAt.getTime()
            ) / 1000
        );
        const accessTokenExpiresAt = new Date(accessTokenExpiresAtSeconds * 1000);

        const refreshToken = createSecureRandomString(32);
        const refreshTokenHash = createHash('sha256').update(refreshToken).digest('base64url');
        const accessToken = await new SignJWT({ sid: sessionId, fid: familyId, sv: sessionVersion })
            .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, typ: 'at+jwt' })
            .setSubject(input.userId)
            .setIssuer(ACCESS_TOKEN_ISSUER)
            .setAudience(ACCESS_TOKEN_AUDIENCE)
            .setJti(accessTokenId)
            .setIssuedAt(accessTokenIssuedAtSeconds)
            .setExpirationTime(accessTokenExpiresAtSeconds)
            .sign(signingKey);

        const session = await this.prismaService.session.create({
            data: {
                id: sessionId,
                version: sessionVersion,
                idleExpiresAt: sessionIdleExpiresAt,
                user: { connect: { id: input.userId } },
                tokenFamily: {
                    create: {
                        id: familyId,
                        accessToken: {
                            create: {
                                id: accessTokenId,
                                createdAt: new Date(accessTokenIssuedAtSeconds * 1000),
                                expiresAt: accessTokenExpiresAt,
                            },
                        },
                        refreshToken: {
                            create: {
                                tokenHash: refreshTokenHash,
                                createdAt: new Date(now),
                                expiresAt: refreshTokenExpiresAt,
                            },
                        },
                    },
                },
            },
        });

        return {
            session: {
                id: session.id,
                userId: session.userId,
                version: session.version,
                idleExpiresAt: session.idleExpiresAt,
                absoluteExpiresAt: session.absoluteExpiresAt,
            },
            tokenFamily: {
                id: familyId,
                accessToken: { value: accessToken, expiresAt: accessTokenExpiresAt },
                refreshToken: { value: refreshToken, expiresAt: refreshTokenExpiresAt },
            },
        };
    }
}
