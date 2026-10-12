import { Simplify } from '@/common/types/index.js';

export interface SessionSnapshot {
    id: string;
    userId: string;
    version: number;
    idleExpiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export type CreateUserSessionInput = {
    userId: string;
};

/** In an ambient transaction, credentials are provisional until its owner confirms commit. */
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

/** Joins only an outer transaction explicitly declared as ReadCommitted. */
export type RotateTokenPairOutput = CreateUserSessionOutput;

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
    items: SessionSnapshot[];
    page: number;
    total: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
};

export type ListUserSessionCursorOutput = {
    type: 'cursor';
    items: SessionSnapshot[];
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevCursor: string | null;
    nextCursor: string | null;
};
