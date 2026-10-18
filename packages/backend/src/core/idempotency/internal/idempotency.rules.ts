import { z } from 'zod';
import { validationDiagnostics } from '@/platform/error/error.validation.js';
import { IdempotencyError } from '../idempotency.error.js';

const id = z.uuid().transform((value) => value.toLowerCase());
const scope = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('workspace'), organizationId: id, workspaceId: id }),
    z.strictObject({ kind: z.literal('organization-user'), organizationId: id, userId: id }),
]);
const fields = {
    scope,
    operation: z
        .string()
        .max(96)
        .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/),
    key: z.string().regex(/^[\x21-\x7e]{1,255}$/),
};
const fingerprintVersion = z.number().int().min(1).max(2_147_483_647);
const fingerprint = z.string().regex(/^[0-9a-f]{64}$/);
export const fingerprintInputSchema = z.strictObject({
    operation: fields.operation,
    version: fingerprintVersion.default(1),
    payload: z.unknown(),
});
export const prepareSchema = z.strictObject({
    ...fields,
    payload: z.unknown(),
    fingerprintVersion: fingerprintVersion.default(1),
});
export const requestSchema = z.strictObject({ ...fields, fingerprintVersion, fingerprint });
const reservationSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('acquired') }),
    z.strictObject({ kind: z.literal('completed'), fingerprint, result: z.unknown() }),
    z.strictObject({ kind: z.literal('in-progress'), fingerprint }),
    z.strictObject({ kind: z.literal('result-unavailable'), fingerprint }),
]);

export function parseIdempotencyInput<Schema extends z.ZodType>(
    schema: Schema,
    input: unknown
): z.output<Schema> {
    const parsed = schema.safeParse(input);
    if (parsed.success) return parsed.data;
    const field = parsed.error.issues[0]?.path[0];
    const reason =
        field === 'scope'
            ? 'invalid-scope'
            : field === 'key'
              ? 'invalid-key'
              : field === 'fingerprint'
                ? 'invalid-fingerprint'
                : 'invalid-input';
    throw new IdempotencyError(
        { reason },
        {
            validationIssues: validationDiagnostics(parsed.error, input, {
                fields: {
                    scope: {},
                    operation: {},
                    key: {},
                    payload: {},
                    fingerprint: {},
                    fingerprintVersion: { scalar: true },
                    version: { scalar: true },
                },
            }),
        }
    );
}

export function parseReservation(input: unknown): z.output<typeof reservationSchema> {
    const parsed = reservationSchema.safeParse(input);
    if (!parsed.success) throw new IdempotencyError({ reason: 'invalid-repository' });
    return parsed.data;
}
