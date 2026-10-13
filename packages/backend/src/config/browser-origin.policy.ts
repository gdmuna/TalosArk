import { z } from 'zod';

export const BrowserOriginSchema = z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
}, 'Expected a canonical HTTP(S) origin without a path');

export const BrowserOriginPolicySchema = z
    .discriminatedUnion('mode', [
        z.object({ mode: z.literal('deny') }),
        z.object({
            mode: z.literal('allowlist'),
            origins: z.array(BrowserOriginSchema).min(1).readonly(),
        }),
        z.object({ mode: z.literal('development-loopback') }),
        z.object({ mode: z.literal('development-any') }),
    ])
    .readonly();

export type BrowserOriginPolicy = z.infer<typeof BrowserOriginPolicySchema>;
