import type * as Session from './session.contract.js';
import type { Prisma } from '@root/prisma/generated/client.js';
import { SessionError } from './session.error.js';
import { mapSessionDatabaseError } from './session.error.mapper.js';

import type { AllConfig } from '@/config/index.js';
import { createSecureRandomString } from '@/common/utils/crypto.js';

import { DatabaseRuntime } from '@/infra/database/database.runtime.js';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';
import { createHash, createPrivateKey, createPublicKey, type KeyObject } from 'crypto';
import { SignJWT, errors, jwtVerify, type JWTPayload } from 'jose';
import { validate as isUuid, v7 as uuidv7 } from 'uuid';
import { observeSessionVerification } from './session.telemetry.js';

const ACCESS_TOKEN_ISSUER = 'talos-ark';
const ACCESS_TOKEN_AUDIENCE = 'talos-ark-api';
const ACCESS_TOKEN_ALGORITHM = 'ES256';

const sessionSelect = {
    id: true,
    userId: true,
    version: true,
    idleExpiresAt: true,
    revokedAt: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.SessionSelect;

function isTokenPairActive(
    tokenPair: {
        revokedAt: Date | null;
        session: { revokedAt: Date | null; idleExpiresAt: Date };
    },
    now: Date
): boolean {
    return (
        tokenPair.revokedAt === null &&
        tokenPair.session.revokedAt === null &&
        tokenPair.session.idleExpiresAt > now
    );
}

@Injectable()
export class SessionKernel {
    private readonly signingKey: KeyObject;
    private readonly verificationKey: KeyObject;

    constructor(
        private readonly database: DatabaseRuntime,
        private readonly configService: ConfigService<AllConfig, true>
    ) {
        const config = this.configService.get('session', { infer: true });
        if (!config.privateKey || !config.publicKey) {
            throw new Error('JWT_ACCESS_PRIVATE_KEY and JWT_ACCESS_PUBLIC_KEY must be configured');
        }
        this.signingKey = createPrivateKey(config.privateKey);
        this.verificationKey = createPublicKey(config.publicKey);
    }

    async createUserSession(
        input: Session.CreateUserSessionInput
    ): Promise<Session.CreateUserSessionOutput> {
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

        const session = await this.execute(() =>
            this.database.queryClient.session.create({
                data: {
                    id: sessionId,
                    version: sessionVersion,
                    idleExpiresAt: sessionIdleExpiresAt.toDate(),
                    user: { connect: { id: input.userId } },
                    tokenPairs: {
                        create: tokenPair.persistence,
                    },
                },
            })
        );

        return {
            session: {
                id: session.id,
                userId: session.userId,
                version: session.version,
                idleExpiresAt: session.idleExpiresAt,
            },
            tokenPair: tokenPair.credentials,
        };
    }

    async rotateTokenPair(
        input: Session.RotateTokenPairInput
    ): Promise<Session.RotateTokenPairOutput> {
        const refreshTokenHash = createHash('sha256')
            .update(input.refreshToken)
            .digest('base64url');

        return this.execute(
            () =>
                this.database.transaction.run(
                    async () => {
                        // Session updates (including revocation) serialize with this lock.
                        const refreshToken = await this.readLockedRefreshToken(refreshTokenHash);
                        const nowDate = new Date();
                        if (!refreshToken || refreshToken.expiresAt <= nowDate) {
                            throw new SessionError({ reason: 'session-inactive' });
                        }
                        if (refreshToken.consumedAt !== null) {
                            throw new SessionError({ reason: 'refresh-token-reused' });
                        }

                        const session = refreshToken.tokenPair.session;
                        if (
                            !isTokenPairActive(refreshToken.tokenPair, nowDate) ||
                            refreshToken.tokenPair.generation !== session.version
                        ) {
                            throw new SessionError({ reason: 'session-inactive' });
                        }

                        const now = dayjs(nowDate).utc();
                        const consumed = await this.database.queryClient.refreshToken.updateMany({
                            where: {
                                id: refreshToken.id,
                                consumedAt: null,
                                expiresAt: { gt: nowDate },
                            },
                            data: { consumedAt: now.startOf('second').toDate() },
                        });
                        if (consumed.count !== 1) {
                            throw new SessionError({ reason: 'session-inactive' });
                        }

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
                        const updatedSession = await this.database.queryClient.session.update({
                            where: {
                                id: session.id,
                                version: session.version,
                                revokedAt: null,
                                idleExpiresAt: { gt: nowDate },
                            },
                            data: {
                                idleExpiresAt: sessionIdleExpiresAt.toDate(),
                                version: { increment: 1 },
                                updatedAt: now.startOf('second').toDate(),
                                tokenPairs: {
                                    create: { ...tokenPair.persistence, generation: nextVersion },
                                },
                            },
                            select: {
                                id: true,
                                userId: true,
                                version: true,
                                idleExpiresAt: true,
                            },
                        });

                        return {
                            session: updatedSession,
                            tokenPair: tokenPair.credentials,
                        };
                    },
                    { isolationLevel: 'ReadCommitted' }
                ),
            true
        );
    }

    async verifyAccessToken(
        input: Session.VerifyAccessTokenInput
    ): Promise<Session.VerifyAccessTokenOutput> {
        return observeSessionVerification(async () => {
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

            const accessToken = await this.execute(() =>
                this.database.queryClient.accessToken.findUnique({
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
                })
            );

            if (!accessToken) return null;

            const now = new Date();
            const tokenPair = accessToken.tokenPair;
            const session = tokenPair.session;
            // Rotation advances the RT generation, not the validity of older, unexpired ATs.
            if (
                accessToken.expiresAt <= now ||
                tokenPair.id !== payload.tpi ||
                tokenPair.generation !== payload.sv ||
                session.id !== payload.sid ||
                session.userId !== payload.sub ||
                !isTokenPairActive(tokenPair, now)
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
        });
    }

    async revokeUserSession(
        input: Session.RevokeUserSessionInput
    ): Promise<Session.RevokeUserSessionOutput> {
        const session = await this.execute(
            () =>
                this.database.queryClient.session.update({
                    where: {
                        id: input.sessionId,
                    },
                    data: {
                        revokedAt: new Date(),
                    },
                    select: {
                        id: true,
                    },
                }),
            true
        );

        return session ? session.id : null;
    }

    async revokeSessionByRefreshToken(input: Session.RotateTokenPairInput): Promise<void> {
        const hash = createHash('sha256').update(input.refreshToken).digest('base64url');
        await this.execute(() =>
            this.database.transaction.run(
                async () => {
                    const token = await this.readLockedRefreshToken(hash);
                    if (
                        token &&
                        token.expiresAt > new Date() &&
                        isTokenPairActive(token.tokenPair, new Date())
                    ) {
                        // A consumed but unexpired RT may revoke its session; it cannot rotate it.
                        await this.database.queryClient.session.update({
                            where: { id: token.tokenPair.session.id },
                            data: { revokedAt: new Date() },
                        });
                    }
                },
                { isolationLevel: 'ReadCommitted' }
            )
        );
    }

    async isFreshUserSession(input: {
        sessionId: string;
        userId: string;
        maxAgeSeconds: number;
    }): Promise<boolean> {
        return this.execute(() =>
            this.database.transaction.run(
                async () => {
                    const locked = await this.database.queryClient.$queryRaw<{ id: string }[]>`
                    SELECT "id" FROM public."Session" WHERE "id" = ${input.sessionId}::uuid FOR UPDATE
                `;
                    if (locked.length === 0) return false;
                    const session = await this.database.queryClient.session.findUnique({
                        where: { id: input.sessionId },
                        select: sessionSelect,
                    });
                    const now = new Date();
                    return (
                        !!session &&
                        session.userId === input.userId &&
                        session.revokedAt === null &&
                        session.idleExpiresAt > now &&
                        session.createdAt.getTime() >= now.getTime() - input.maxAgeSeconds * 1000
                    );
                },
                { propagation: 'mandatory' }
            )
        );
    }

    async revokeUserSessionAll(
        input: Session.RevokeUserSessionAllInput
    ): Promise<Session.RevokeUserSessionAllOutput> {
        const session = await this.execute(() =>
            this.database.queryClient.session.updateManyAndReturn({
                where: {
                    userId: input.userId,
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                },
                select: {
                    id: true,
                },
            })
        );

        if (session.length > 0) {
            return {
                sessionId: session.map((item) => item.id),
                count: session.length,
            };
        }
        return null;
    }

    async listUserSession(
        input: Session.ListUserSessionInput
    ): Promise<Session.ListUserSessionOutput> {
        const { type } = input;
        if (type === 'cursor') {
            const { userId, cursor, order, direction } = input;
            if (direction === 'backward' && !cursor) {
                throw new RangeError('Backward cursor pagination requires a cursor');
            }

            const pageSize = Math.max(Math.min(input.pageSize, 1000), 1);
            const queryOrder =
                direction === 'backward' ? (order === 'asc' ? 'desc' : 'asc') : order;
            const rows = await this.execute(() =>
                this.database.queryClient.session.findMany({
                    where: { userId },
                    select: sessionSelect,
                    orderBy: { id: queryOrder },
                    ...(cursor ? { cursor: { id: cursor, userId }, skip: 1 } : {}),
                    take: pageSize + 1,
                })
            );

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
        const [items, total] = await this.execute(() =>
            this.database.transaction.run(async () => {
                const items = await this.database.queryClient.session.findMany({
                    where,
                    select: sessionSelect,
                    orderBy: { id: order },
                    skip,
                    take: pageSize,
                });
                const total = await this.database.queryClient.session.count({ where });
                return [items, total] as const;
            })
        );

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

    private async readLockedRefreshToken(tokenHash: string) {
        // The caller retains its ReadCommitted transaction through the subsequent writes.
        // Return post-lock facts only; admission and time remain caller-owned.
        const locked = await this.database.queryClient.$queryRaw<{ id: string }[]>`
            SELECT s."id"
            FROM "public"."Session" s
            JOIN "public"."TokenPair" p ON p."sessionId" = s."id"
            JOIN "public"."RefreshToken" r ON r."pairId" = p."id"
            WHERE r."tokenHash" = ${tokenHash}
            FOR UPDATE OF s
        `;
        if (locked.length === 0) return null;
        // The previous lock holder may have consumed or revoked these credentials.
        return await this.database.queryClient.refreshToken.findUnique({
            where: { tokenHash },
            select: {
                id: true,
                consumedAt: true,
                expiresAt: true,
                tokenPair: {
                    select: {
                        generation: true,
                        revokedAt: true,
                        session: {
                            select: {
                                id: true,
                                userId: true,
                                version: true,
                                idleExpiresAt: true,
                                revokedAt: true,
                            },
                        },
                    },
                },
            },
        });
    }

    private async execute<T>(
        operation: () => PromiseLike<T>,
        inactiveOnMissing = false
    ): Promise<T> {
        try {
            return await operation();
        } catch (cause) {
            throw mapSessionDatabaseError(cause, inactiveOnMissing) ?? cause;
        }
    }

    private async generateTokenPair(input: {
        payload: { sub: string; sid: string; sv: number };
        sessionIdleExpiresAtUnix: number;
        timeReference: Date;
    }) {
        const config = this.configService.get('session', { infer: true });

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

        const tokenPair = {
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
        return {
            persistence: {
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
            credentials: {
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
}
