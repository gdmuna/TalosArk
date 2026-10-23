import { z } from 'zod';
import { AccountProvisionInputSchema } from '@talos-ark/contracts/auth';
import type { CreateUserProfileInput } from '../../../src/core/identity/identity.contract.js';
import type { SeederKind } from '../seed.definition.js';

// The runtime representation is JSON; the boundary conversion is checked against the kernel input.
export const accountProfileSchema = z.strictObject({
    nickname: z.string().max(120).nullable().optional(),
    bio: z.string().max(500).nullable().optional(),
    sex: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
    sexVisible: z.boolean().optional(),
    birthday: z.iso.date().nullable().optional(),
});
export function accountProfile(
    value: z.output<typeof accountProfileSchema>
): CreateUserProfileInput {
    return {
        nickname: value.nickname,
        bio: value.bio,
        sex: value.sex,
        sexVisible: value.sexVisible,
        birthday: value.birthday ? new Date(`${value.birthday}T00:00:00Z`) : null,
    } satisfies CreateUserProfileInput;
}
export const accountReferenceSchema = AccountProvisionInputSchema.extend({
    userId: z.uuid(),
    active: z.boolean(),
});
export const accountsKind = {
    id: 'account',
    data: z.strictObject({
        accounts: z
            .array(
                z.strictObject({
                    key: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
                    input: AccountProvisionInputSchema,
                    profile: accountProfileSchema.optional(),
                    active: z.boolean().default(true),
                })
            )
            .min(1)
            .max(200)
            .refine(
                (items) => new Set(items.map((item) => item.key)).size === items.length,
                'Duplicate account key'
            ),
    }),
    input: z.strictObject({}),
    output: z.record(z.string(), accountReferenceSchema),
} satisfies SeederKind;
