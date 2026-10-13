import { z } from 'zod';
import { SessionCredentialsSchema } from './session.js';
import { LocalPasswordSchema } from './password.js';

export const LocalUsernameSchema = z.string().trim().min(1).max(64);
export const LocalEmailSchema = z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((value) => value.toLowerCase());
export const AccountProvisionInputSchema = z.strictObject({
    username: LocalUsernameSchema,
    email: LocalEmailSchema,
});

export const PasswordLoginBodySchema = z.strictObject({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(256),
});
export const PasswordLoginResponseSchema = SessionCredentialsSchema;

export const AccountActivateBodySchema = z.strictObject({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    password: LocalPasswordSchema,
});
export const PasswordSetBodySchema = z.strictObject({ password: LocalPasswordSchema });

export type AccountProvisionInput = z.infer<typeof AccountProvisionInputSchema>;
export type PasswordLoginBody = z.infer<typeof PasswordLoginBodySchema>;
export type PasswordLoginResponse = z.infer<typeof PasswordLoginResponseSchema>;
export type AccountActivateBody = z.infer<typeof AccountActivateBodySchema>;
export type PasswordSetBody = z.infer<typeof PasswordSetBodySchema>;
