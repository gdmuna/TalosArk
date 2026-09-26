export interface CreateUserSessionInput {
    userId: string;
}

export interface CreateUserSessionOutput {
    session: {
        id: string;
        userId: string;
        version: number;
        idleExpiresAt: Date;
        absoluteExpiresAt: Date | null;
    };
    tokenFamily: {
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
}
