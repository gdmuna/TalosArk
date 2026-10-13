import { z } from 'zod';
import { UuidSchema, UtcDateTimeSchema } from '../protocol/scalar.js';

export const CurrentAccountResponseSchema = z.object({
    id: UuidSchema,
    username: z.string(),
    email: z.email(),
    createdAt: UtcDateTimeSchema,
    profile: z
        .object({
            nickname: z.string().nullable(),
            avatarId: z.string().nullable(),
            bio: z.string().nullable(),
            sex: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable(),
            sexVisible: z.boolean(),
            birthday: UtcDateTimeSchema.nullable(),
        })
        .nullable(),
});
export type CurrentAccountResponse = z.infer<typeof CurrentAccountResponseSchema>;
