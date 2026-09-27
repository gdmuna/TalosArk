import type * as Prisma from '@root/prisma/generated/models.js';

import { Simplify } from '@/common/types/index.js';

export type CreateUserSessionInput = {
    userId: string;
};

export type CreateUserSessionOutput = {
    session: {
        id: string;
        userId: string;
        version: number;
        idleExpiresAt: Date;
    };
    tokenPair: {
        id: string;
        accessToken: {
            value: string;
            expiresAt: Date;
        };
        refreshToken: {
            value: string;
            expiresAt: Date;
        };
    };
};

export type RotateTokenPairInput = {
    refreshToken: string;
};

export type RotateTokenPairOutput = {
    session: {
        id: string;
        userId: string;
        version: number;
        idleExpiresAt: Date;
    };
    tokenPair: {
        id: string;
        accessToken: {
            value: string;
            expiresAt: Date;
        };
        refreshToken: {
            value: string;
            expiresAt: Date;
        };
    };
};

export type VerifyAccessTokenInput = {
    accessToken: string;
};

export type VerifyAccessTokenOutput = {
    sub: string;
    sid: string;
    sv: number;
    tpi: string;
    jti: string;
    iat: number;
    exp: number;
} | null;

export type RevokeUserSessionInput = {
    sessionId: string;
};

export type RevokeUserSessionOutput = string | null;

export type RevokeUserSessionAllInput = {
    userId: string;
};

export type RevokeUserSessionAllOutput = {
    sessionId: string[];
    count: number;
} | null;

export type ListUserSessionInput = Simplify<
    ListUserSessionOffsetInput | ListUserSessionCursorInput
>;

export type ListUserSessionOffsetInput = {
    type: 'offset';
    userId: string;
    page: number;
    pageSize: number;
    order: 'asc' | 'desc';
};

export type ListUserSessionCursorInput = {
    type: 'cursor';
    userId: string;
    pageSize: number;
    order: 'asc' | 'desc';
} & ({ direction: 'forward'; cursor?: string } | { direction: 'backward'; cursor: string });

export type ListUserSessionOutput = ListUserSessionOffsetOutput | ListUserSessionCursorOutput;

export type ListUserSessionOffsetOutput = {
    type: 'offset';
    items: Prisma.SessionModel[];
    page: number;
    total: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
};

export type ListUserSessionCursorOutput = {
    type: 'cursor';
    items: Prisma.SessionModel[];
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevCursor: string | null;
    nextCursor: string | null;
};

export type GenerateTokenPairInput = {
    payload: {
        sub: string;
        sid: string;
        sv: number;
    };
    sessionIdleExpiresAtUnix: number;
    timeReference: Date;
};

export type GenerateTokenPairOutput = {
    accessToken: {
        value: string;
        expiresAt: Date;
        jti: string;
    };
    refreshToken: {
        value: string;
        expiresAt: Date;
        hash: string;
    };
    tokenPairId: string;
};
