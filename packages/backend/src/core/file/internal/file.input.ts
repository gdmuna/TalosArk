import { z } from 'zod';
import { FileError } from '../file.error.js';
import { validationDiagnostics } from '@/platform/error/error.validation.js';

const id = z.uuid().transform((value) => value.toLowerCase());
// eslint-disable-next-line no-control-regex -- Filenames must not inject controls or path separators.
const filenamePattern = /^[^\x00-\x1f\x7f/\\]+$/;
// eslint-disable-next-line no-control-regex -- Provider ETags are opaque printable protocol values.
const etagPattern = /^[^\x00-\x1f\x7f]+$/;
export const actorFields = { organizationId: id, userId: id };
export const sessionSchema = z.strictObject({ ...actorFields, sessionId: id });
export const assetSchema = z.strictObject({ ...actorFields, assetId: id });
export const beginSchema = z.strictObject({
    ...actorFields,
    idempotencyKey: id,
    filename: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .regex(filenamePattern)
        .refine((value) => value.isWellFormed()),
    contentType: z
        .string()
        .max(127)
        .regex(/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/)
        .transform((value) => value.toLowerCase()),
    sizeBytes: z.number().int().min(0).max(5_000_000_000),
    sha256: z
        .string()
        .regex(/^[0-9a-fA-F]{64}$/)
        .transform((value) => value.toLowerCase()),
    mode: z.enum(['single', 'multipart']),
});
export const partSchema = sessionSchema.extend({
    partNumber: z.number().int().min(1).max(10000).optional(),
});
export const manifestSchema = z
    .array(
        z.strictObject({
            partNumber: z.number().int().min(1).max(10000),
            etag: z.string().min(1).max(200).regex(etagPattern),
        })
    )
    .min(1)
    .max(10000)
    .transform((parts) => parts.sort((a, b) => a.partNumber - b.partNumber));
export const completeSchema = sessionSchema.extend({ parts: manifestSchema.optional() });

export function parseFileInput<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success)
        throw new FileError(
            { reason: 'invalid-input' },
            {
                validationIssues: validationDiagnostics(result.error, input, {
                    fields: {
                        organizationId: {},
                        userId: {},
                        sessionId: {},
                        assetId: {},
                        filename: {},
                        contentType: {},
                        sizeBytes: { scalar: true },
                        sha256: {},
                        parts: {},
                        partNumber: { scalar: true },
                    },
                }),
            }
        );
    return result.data;
}
