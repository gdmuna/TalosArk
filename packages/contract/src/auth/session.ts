import { z } from 'zod';
import { UtcDateTimeSchema, UuidSchema } from '../protocol/scalar.js';

export const SessionCredentialsSchema = z.object({
    session: z.object({
        id: UuidSchema,
        userId: UuidSchema,
        version: z.int().positive(),
        idleExpiresAt: UtcDateTimeSchema,
    }),
    tokenPair: z.object({
        id: UuidSchema,
        accessToken: z.object({
            value: z.string().min(1),
            expiresAt: UtcDateTimeSchema,
        }),
        refreshToken: z.object({
            value: z.string().min(1),
            expiresAt: UtcDateTimeSchema,
        }),
    }),
});

export type SessionCredentials = z.infer<typeof SessionCredentialsSchema>;
