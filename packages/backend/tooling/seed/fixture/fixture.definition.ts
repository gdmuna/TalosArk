import { z } from 'zod';
export const fixtureFileRefSchema = z.strictObject({
    kind: z.literal('fixture'),
    id: z
        .string()
        .max(240)
        .regex(/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/)
        .refine((id) => !id.split('/').some((part) => !part || part === '.' || part === '..')),
});
export type FixtureFileRef = z.infer<typeof fixtureFileRefSchema>;
export interface FixtureFileFacts {
    readonly id: string;
    readonly sizeBytes: number;
    readonly sha256: string;
}
