import type * as Access from './access.contract.js';

import type { AllConfig } from '@/config/index.js';
import { createSecureRandomString } from '@/common/utils/index.js';

import { PrismaService } from '@/infra/database/prisma/prisma.service.js';
import { KvsClient } from '@/infra/kvs/index.js';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';
import { createHash, createPrivateKey, createPublicKey, type KeyObject } from 'crypto';
import { SignJWT, errors, jwtVerify, type JWTPayload } from 'jose';
import { validate as isUuid, v7 as uuidv7 } from 'uuid';

const ACCESS_TOKEN_ISSUER = 'talos-ark';
const ACCESS_TOKEN_AUDIENCE = 'talos-ark-api';
const ACCESS_TOKEN_ALGORITHM = 'ES256';

@Injectable()
export class AccessKernel {
    private readonly signingKey: KeyObject;
    private readonly verificationKey: KeyObject;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly kvsClient: KvsClient,
        private readonly configService: ConfigService<AllConfig, true>
    ) {
        const config = this.configService.get('access', { infer: true });
        if (!config.privateKey || !config.publicKey) {
            throw new Error('JWT_ACCESS_PRIVATE_KEY and JWT_ACCESS_PUBLIC_KEY must be configured');
        }
        this.signingKey = createPrivateKey(config.privateKey);
        this.verificationKey = createPublicKey(config.publicKey);
    }

    async createUserSession(
        input: Access.CreateUserSessionInput
    ): Promise<Access.CreateUserSessionOutput> {
        const nowDate = new Date();
        const now = dayjs(nowDate).utc();
        const sessionIdleExpiresAt = now.add(30, 'day');
        const sessionId = uuidv7();
        const sessionVersion = 1;

        const tokenPair = await this.generateTokenPair({
            payload: {
                sid: sessionId,
                sub: input.userId,
                sv: sessionVersion,
            },
            sessionIdleExpiresAtUnix: sessionIdleExpiresAt.diff(now, 'second'),
            timeReference: nowDate,
        });

        const session = await this.prismaService.session.create({
            data: {
                id: sessionId,
                version: sessionVersion,
                idleExpiresAt: sessionIdleExpiresAt.toDate(),
                user: { connect: { id: input.userId } },
                tokenPairs: {
                    create: {
                        id: tokenPair.tokenPairId,
                        accessToken: {
                            create: {
                                id: tokenPair.accessToken.jti,
                                // Match the persisted issue time to the JWT's rounded-down iat.
                                createdAt: now.startOf('second').toDate(),
                                expiresAt: tokenPair.accessToken.expiresAt,
                            },
                        },
                        refreshToken: {
                            create: {
                                tokenHash: tokenPair.refreshToken.hash,
                                createdAt: now.startOf('second').toDate(),
                                expiresAt: tokenPair.refreshToken.expiresAt,
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
            },
            tokenPair: {
                id: tokenPair.tokenPairId,
                accessToken: {
                    value: tokenPair.accessToken.value,
                    expiresAt: tokenPair.accessToken.expiresAt,
                },
                refreshToken: {
                    value: tokenPair.refreshToken.value,
                    expiresAt: tokenPair.refreshToken.expiresAt,
                },
            },
        };
    }

    async rotateTokenPair(
        input: Access.RotateTokenPairInput
    ): Promise<Access.RotateTokenPairOutput> {
        const nowDate = new Date();
        const refreshTokenHash = createHash('sha256')
            .update(input.refreshToken)
            .digest('base64url');

        const unionData = await this.prismaService.refreshToken.findUnique({
            where: {
                tokenHash: refreshTokenHash,
                expiresAt: { gt: nowDate },
            },
            select: {
                consumedAt: true,
                tokenPair: {
                    select: {
                        session: true,
                    },
                },
            },
        });

        const session = unionData?.tokenPair.session;
        if (unionData?.consumedAt || !session) {
            throw new Error('wtf');
        }

        if (session.revokedAt) {
            throw new Error('wtf');
        }

        const now = dayjs(nowDate).utc();
        const sessionIdleExpiresAt = now.add(30, 'day');
        const nextVersion = session.version + 1;

        const tokenPair = await this.generateTokenPair({
            payload: {
                sid: session.id,
                sub: session.userId,
                sv: nextVersion,
            },
            sessionIdleExpiresAtUnix: sessionIdleExpiresAt.diff(now, 'second'),
            timeReference: nowDate,
        });

        const updatedSession = await this.prismaService.session.update({
            where: {
                id: session.id,
                revokedAt: null,
            },
            data: {
                idleExpiresAt: sessionIdleExpiresAt.toDate(),
                version: nextVersion,
                updatedAt: now.startOf('second').toDate(),
                tokenPairs: {
                    create: {
                        id: tokenPair.tokenPairId,
                        generation: nextVersion,
                        accessToken: {
                            create: {
                                id: tokenPair.accessToken.jti,
                                // Match the persisted issue time to the JWT's rounded-down iat.
                                createdAt: now.startOf('second').toDate(),
                                expiresAt: tokenPair.accessToken.expiresAt,
                            },
                        },
                        refreshToken: {
                            create: {
                                tokenHash: tokenPair.refreshToken.hash,
                                createdAt: now.startOf('second').toDate(),
                                expiresAt: tokenPair.refreshToken.expiresAt,
                            },
                        },
                    },
                },
            },
        });

        return {
            session: {
                id: updatedSession.id,
                userId: updatedSession.userId,
                version: updatedSession.version,
                idleExpiresAt: updatedSession.idleExpiresAt,
            },
            tokenPair: {
                id: tokenPair.tokenPairId,
                accessToken: {
                    value: tokenPair.accessToken.value,
                    expiresAt: tokenPair.accessToken.expiresAt,
                },
                refreshToken: {
                    value: tokenPair.refreshToken.value,
                    expiresAt: tokenPair.refreshToken.expiresAt,
                },
            },
        };
    }

    async verifyAccessToken(
        input: Access.VerifyAccessTokenInput
    ): Promise<Access.VerifyAccessTokenOutput> {
        let payload: JWTPayload;
        try {
            ({ payload } = await jwtVerify(input.accessToken, this.verificationKey, {
                algorithms: [ACCESS_TOKEN_ALGORITHM],
                typ: 'at+jwt',
                issuer: ACCESS_TOKEN_ISSUER,
                audience: ACCESS_TOKEN_AUDIENCE,
                requiredClaims: ['sub', 'sid', 'sv', 'tpi', 'jti', 'iat', 'exp'],
            }));
        } catch (error) {
            if (error instanceof errors.JOSEError) return null;
            throw error;
        }

        if (
            typeof payload.sub !== 'string' ||
            !isUuid(payload.sub) ||
            typeof payload.sid !== 'string' ||
            !isUuid(payload.sid) ||
            typeof payload.tpi !== 'string' ||
            !isUuid(payload.tpi) ||
            typeof payload.jti !== 'string' ||
            !isUuid(payload.jti) ||
            typeof payload.sv !== 'number' ||
            !Number.isSafeInteger(payload.sv) ||
            payload.sv < 1 ||
            typeof payload.iat !== 'number' ||
            !Number.isSafeInteger(payload.iat) ||
            typeof payload.exp !== 'number' ||
            !Number.isSafeInteger(payload.exp) ||
            payload.aud !== ACCESS_TOKEN_AUDIENCE
        ) {
            return null;
        }

        const accessToken = await this.prismaService.accessToken.findUnique({
            where: { id: payload.jti },
            select: {
                expiresAt: true,
                tokenPair: {
                    select: {
                        id: true,
                        generation: true,
                        revokedAt: true,
                        session: {
                            select: {
                                id: true,
                                userId: true,
                                idleExpiresAt: true,
                                revokedAt: true,
                            },
                        },
                    },
                },
            },
        });

        if (!accessToken) return null;

        const now = new Date();
        const tokenPair = accessToken.tokenPair;
        const session = tokenPair.session;
        if (
            accessToken.expiresAt <= now ||
            tokenPair.id !== payload.tpi ||
            tokenPair.generation !== payload.sv ||
            tokenPair.revokedAt !== null ||
            session.id !== payload.sid ||
            session.userId !== payload.sub ||
            session.idleExpiresAt <= now ||
            session.revokedAt !== null
        ) {
            return null;
        }

        return {
            sub: payload.sub,
            sid: payload.sid,
            sv: payload.sv,
            tpi: payload.tpi,
            jti: payload.jti,
            iat: payload.iat,
            exp: payload.exp,
        };
    }

    async revokeUserSession(
        input: Access.RevokeUserSessionInput
    ): Promise<Access.RevokeUserSessionOutput> {
        const session = await this.prismaService.session.update({
            where: {
                id: input.sessionId,
            },
            data: {
                revokedAt: new Date(),
            },
            select: {
                id: true,
            },
        });

        return session ? session.id : null;
    }

    async revokeUserSessionAll(
        input: Access.RevokeUserSessionAllInput
    ): Promise<Access.RevokeUserSessionAllOutput> {
        const session = await this.prismaService.session.updateManyAndReturn({
            where: {
                userId: input.userId,
            },
            data: {
                revokedAt: new Date(),
            },
            select: {
                id: true,
            },
        });

        if (session.length > 0) {
            return {
                sessionId: session.map((item) => item.id),
                count: session.length,
            };
        }
        return null;
    }

    async listUserSession(
        input: Access.ListUserSessionInput
    ): Promise<Access.ListUserSessionOutput> {
        const { type } = input;
        if (type === 'cursor') {
            const { userId, cursor, order, direction } = input;
            if (direction === 'backward' && !cursor) {
                throw new RangeError('Backward cursor pagination requires a cursor');
            }

            const pageSize = Math.max(Math.min(input.pageSize, 1000), 1);
            const queryOrder =
                direction === 'backward' ? (order === 'asc' ? 'desc' : 'asc') : order;
            const rows = await this.prismaService.session.findMany({
                where: { userId },
                orderBy: { id: queryOrder },
                ...(cursor ? { cursor: { id: cursor, userId }, skip: 1 } : {}),
                take: pageSize + 1,
            });

            const items = rows.slice(0, pageSize);
            if (direction === 'backward') items.reverse();

            const hasMoreInDirection = rows.length > pageSize;
            const hasPrevPage =
                direction === 'backward' ? hasMoreInDirection : Boolean(cursor && items.length > 0);
            const hasNextPage = direction === 'forward' ? hasMoreInDirection : items.length > 0;
            return {
                type: 'cursor',
                items,
                hasPrevPage,
                hasNextPage,
                prevCursor: hasPrevPage ? (items[0]?.id ?? null) : null,
                nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
            };
        }

        // offset
        const { userId, order } = input;
        const page = Math.max(Math.min(input.page, 10000), 1);
        const pageSize = Math.max(Math.min(input.pageSize, 1000), 1);
        const where = { userId };
        const skip = Math.max((page - 1) * pageSize, 0);
        const [items, total] = await this.prismaService.$transaction([
            this.prismaService.session.findMany({
                where,
                orderBy: { id: order },
                skip,
                take: pageSize,
            }),
            this.prismaService.session.count({ where }),
        ]);

        const totalPages = Math.ceil(total / pageSize);
        const currentPage = Math.min(totalPages, page);
        const hasPrevPage = currentPage > 1;
        const hasNextPage = currentPage < totalPages;

        return {
            type: 'offset',
            items,
            page,
            total,
            totalPages,
            hasPrevPage,
            hasNextPage,
        };
    }

    private async generateTokenPair(
        input: Access.GenerateTokenPairInput
    ): Promise<Access.GenerateTokenPairOutput> {
        const config = this.configService.get('access', { infer: true });

        // Base all lifetimes on one UTC instant so their boundaries are consistent.
        const now = dayjs(input.timeReference).utc();
        const tokenPairId = uuidv7();
        const accessTokenId = uuidv7();
        // UTC days are fixed 24-hour periods, including across local daylight saving changes.
        const refreshTokenExpiresAt = now.add(7, 'day');
        // Encode iat/exp as whole Unix seconds; cap AT by its TTL, session, and RT.
        const accessTokenIssuedAtSeconds = now.unix();
        const accessTokenTtlSeconds = Math.min(
            config.accessTokenTtlSeconds,
            input.sessionIdleExpiresAtUnix,
            refreshTokenExpiresAt.diff(now, 'second')
        );
        const accessTokenExpiresAt = now.add(accessTokenTtlSeconds, 'second').startOf('second');
        const accessTokenExpiresAtSeconds = accessTokenExpiresAt.unix();

        const refreshToken = createSecureRandomString();
        const refreshTokenHash = createHash('sha256').update(refreshToken).digest('base64url');
        const accessToken = await new SignJWT({
            sid: input.payload.sid,
            sv: input.payload.sv,
            tpi: tokenPairId,
        })
            .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, typ: 'at+jwt' })
            .setSubject(input.payload.sub)
            .setIssuer(ACCESS_TOKEN_ISSUER)
            .setAudience(ACCESS_TOKEN_AUDIENCE)
            .setJti(accessTokenId)
            .setIssuedAt(accessTokenIssuedAtSeconds)
            .setExpirationTime(accessTokenExpiresAtSeconds)
            .sign(this.signingKey);

        return {
            accessToken: {
                value: accessToken,
                expiresAt: accessTokenExpiresAt.startOf('second').toDate(),
                jti: accessTokenId,
            },
            refreshToken: {
                value: refreshToken,
                expiresAt: refreshTokenExpiresAt.startOf('second').toDate(),
                hash: refreshTokenHash,
            },
            tokenPairId,
        };
    }
}
