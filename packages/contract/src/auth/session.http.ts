import { z } from 'zod';
import { SessionCredentialsSchema } from './session.js';

export const SessionRefreshBodySchema = z.strictObject({
    refreshToken: z.string().min(1),
});

export const SessionRefreshResponseSchema = SessionCredentialsSchema;

export type SessionRefreshBody = z.infer<typeof SessionRefreshBodySchema>;
export type SessionRefreshResponse = z.infer<typeof SessionRefreshResponseSchema>;
