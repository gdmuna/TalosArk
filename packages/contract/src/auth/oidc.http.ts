import { z } from 'zod';
import { SessionCredentialsSchema } from './session.js';

export const OidcStartResponseSchema = z.object({
    url: z.url(),
});

export const OidcLoginCallbackBodySchema = z.strictObject({
    code: z.string().min(1),
    state: z.string().min(1),
});

export const OidcLoginCallbackResponseSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('success'),
        data: SessionCredentialsSchema,
    }),
    z.object({
        type: z.literal('block'),
        data: z.object({}),
    }),
]);

export type OidcStartResponse = z.infer<typeof OidcStartResponseSchema>;
export type OidcLoginCallbackBody = z.infer<typeof OidcLoginCallbackBodySchema>;
export type OidcLoginCallbackResponse = z.infer<typeof OidcLoginCallbackResponseSchema>;
