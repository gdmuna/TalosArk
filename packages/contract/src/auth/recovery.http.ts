import { z } from 'zod';
import { LocalEmailSchema } from './password.http.js';
import { LocalPasswordSchema } from './password.js';

export const PasswordRecoveryTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const PasswordRecoveryRequestBodySchema = z.strictObject({ email: LocalEmailSchema });
export const PasswordRecoveryRequestResponseSchema = z.strictObject({
    status: z.literal('accepted'),
    retryAfterSeconds: z.number().int().min(1),
});
export const PasswordRecoveryConfirmBodySchema = z.strictObject({
    token: PasswordRecoveryTokenSchema,
    password: LocalPasswordSchema,
});
export const PasswordRecoveryConfirmResponseSchema = z.strictObject({
    status: z.literal('completed'),
});

export type PasswordRecoveryRequestBody = z.infer<typeof PasswordRecoveryRequestBodySchema>;
export type PasswordRecoveryRequestResponse = z.infer<typeof PasswordRecoveryRequestResponseSchema>;
export type PasswordRecoveryConfirmBody = z.infer<typeof PasswordRecoveryConfirmBodySchema>;
export type PasswordRecoveryConfirmResponse = z.infer<typeof PasswordRecoveryConfirmResponseSchema>;
