import { z } from 'zod';
import { AuditError } from '../audit.error.js';
import type { AuditRecordInput, AuditValue } from '../audit.contract.js';
import { configurationIssue, validationDiagnostics } from '@/platform/error/error.validation.js';

const uuid = z.uuid().transform((value) => value.toLowerCase());
const date = z
    .date()
    .min(new Date('0001-01-01T00:00:00.000Z'))
    .max(new Date('9999-12-31T23:59:59.999Z'))
    .transform((value) => new Date(value));
const text = (max: number) =>
    z
        .string()
        .min(1)
        .max(max)
        // eslint-disable-next-line no-control-regex -- Audit metadata must not contain control bytes.
        .regex(/^[^\u0000-\u001f\u007f-\u009f]*$/)
        .refine((value) => value.isWellFormed());
const recordSchema = z.strictObject({
    organizationId: uuid,
    workspaceId: uuid.optional(),
    actorUserId: uuid,
    action: z
        .string()
        .max(100)
        .regex(/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/),
    occurredAt: date,
    requestId: text(128).optional(),
    details: z.unknown().optional(),
    resources: z
        .array(z.strictObject({ resourceId: uuid, labelSnapshot: text(200) }))
        .max(32)
        .default([]),
});

const listSchema = z.strictObject({
    scope: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('organization'), organizationId: uuid }),
        z.strictObject({ kind: z.literal('workspace'), organizationId: uuid, workspaceId: uuid }),
    ]),
    resourceId: uuid.optional(),
    from: date.optional(),
    until: date.optional(),
    limit: z.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).max(1024).optional(),
});

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
    const result = schema.safeParse(input);
    if (!result.success)
        throw new AuditError(
            { reason: 'invalid-input' },
            {
                validationIssues: validationDiagnostics(result.error, input, {
                    fields: Object.fromEntries(
                        [
                            'organizationId',
                            'workspaceId',
                            'actorUserId',
                            'action',
                            'occurredAt',
                            'requestId',
                            'resources',
                            'scope',
                            'resourceId',
                            'from',
                            'until',
                            'limit',
                            'cursor',
                        ].map((key) => [key, { scalar: key === 'limit' }])
                    ),
                }),
            }
        );
    return result.data;
}

function invalid(field: string, expected: string, received: unknown): never {
    throw new AuditError(
        { reason: 'invalid-input' },
        { validationIssues: [configurationIssue(field, expected, received)] }
    );
}

// These exact keys are a guardrail, not a substitute for the caller's field whitelist.
const credentialKeys = new Set([
    'password',
    'passwordhash',
    'secret',
    'clientsecret',
    'token',
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'authorization',
    'cookie',
    'setcookie',
    'credential',
    'credentials',
    'privatekey',
]);

function snapshotDetails(input: unknown): { [key: string]: AuditValue } {
    let bytes = 0;
    let nodes = 0;
    const seen = new Set<object>();
    const add = (size: number) => {
        bytes += size;
        if (bytes > 16_384) invalid('details', 'JSON encoded as at most 16384 UTF-8 bytes', input);
    };
    const visit = (value: unknown, depth: number): AuditValue => {
        if (depth > 8 || ++nodes > 2000)
            invalid('details', 'JSON depth <= 8 and at most 2000 values', input);
        if (value === null || ['string', 'boolean', 'number'].includes(typeof value)) {
            if (typeof value === 'number' && !Number.isFinite(value))
                invalid('details', 'finite JSON numbers', value);
            if (typeof value === 'string' && (!value.isWellFormed() || value.includes('\u0000')))
                invalid('details', 'well-formed Unicode without NUL (PostgreSQL JSON)', value);
            add(Buffer.byteLength(JSON.stringify(value), 'utf8'));
            return value as string | number | boolean | null;
        }
        if (!value || typeof value !== 'object') invalid('details', 'plain JSON values', value);
        if (seen.has(value)) invalid('details', 'JSON without circular references', input);
        const array = Array.isArray(value);
        if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
            invalid('details', 'plain JSON objects, not class instances', value);
        seen.add(value);
        add(2);
        const keys = Reflect.ownKeys(value).filter((key) => !(array && key === 'length'));
        if (keys.length > 2000) invalid('details', 'at most 2000 values', input);
        const output: AuditValue[] | Record<string, AuditValue> = array ? [] : {};
        if (array && keys.length !== value.length) invalid('details', 'dense JSON arrays', input);
        for (const [index, key] of keys.entries()) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (
                typeof key !== 'string' ||
                !descriptor ||
                !descriptor.enumerable ||
                !('value' in descriptor)
            )
                invalid('details', 'enumerable data properties, not getters or symbols', input);
            if (array) {
                if (key !== String(index))
                    invalid('details', 'dense JSON arrays without extra properties', input);
            } else {
                if (
                    key.length > 128 ||
                    !key.isWellFormed() ||
                    key.includes('\u0000') ||
                    ['__proto__', 'constructor', 'prototype'].includes(key)
                )
                    invalid('details', 'safe JSON keys of at most 128 characters', input);
                if (credentialKeys.has(key.replace(/[-_]/g, '').toLowerCase()))
                    invalid('details', 'explicit business facts without credential fields', input);
                add(Buffer.byteLength(JSON.stringify(key), 'utf8') + 1);
            }
            if (index) add(1);
            Object.defineProperty(output, key, {
                value: visit(descriptor.value, depth + 1),
                enumerable: true,
                writable: true,
                configurable: true,
            });
        }
        seen.delete(value);
        return output;
    };
    if (!input || typeof input !== 'object' || Array.isArray(input))
        invalid('details', 'a plain JSON object', input);
    return visit(input, 0) as { [key: string]: AuditValue };
}

export function parseAuditRecord(input: AuditRecordInput) {
    const result = parse(recordSchema, input);
    if (
        new Set(result.resources.map((resource) => resource.resourceId)).size !==
        result.resources.length
    )
        invalid('resources', 'each resource referenced once', result.resources);
    return {
        ...result,
        details: result.details === undefined ? undefined : snapshotDetails(result.details),
    };
}

export function parseAuditList(input: unknown) {
    const result = parse(listSchema, input);
    if (result.from && result.until && result.from >= result.until)
        invalid('until', 'a time strictly after from (range is [from, until))', result.until);
    return result;
}

export type ParsedAuditRecord = ReturnType<typeof parseAuditRecord>;
export type ParsedAuditList = ReturnType<typeof parseAuditList>;
