import { z } from 'zod';
import { validationDiagnostics } from '@/platform/error/error.validation.js';
import type { ExtensionEntry } from '@/platform/extensions/index.js';
import { PermissionError } from './permission.error.js';

export type AuthorizationScope = 'ORGANIZATION' | 'WORKSPACE';

export interface AuthorizationDefinition {
    readonly code: string;
    readonly name: string;
    readonly scope: AuthorizationScope;
}

export interface AuthorizationMetadata {
    readonly namespace: string;
    readonly definitions: readonly AuthorizationDefinition[];
}

export interface AuthorizationRegistryOptions {
    readonly explicit?: readonly ExtensionEntry<string, AuthorizationDefinition>[];
    readonly discovery?: boolean;
    readonly required?: readonly { readonly code: string; readonly scope: AuthorizationScope }[];
}

const definitionSchema = z.strictObject({
    code: z
        .string()
        .max(120)
        .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/),
    name: z
        .string()
        .trim()
        .min(1)
        .max(160)
        // eslint-disable-next-line no-control-regex -- Definition names must not inject terminal controls.
        .regex(/^[^\u0000-\u001f\u007f-\u009f]+$/),
    scope: z.enum(['ORGANIZATION', 'WORKSPACE']),
});

const metadataSchema = z
    .strictObject({
        namespace: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
        definitions: z.array(definitionSchema).min(1).max(256),
    })
    .refine((metadata) =>
        metadata.definitions.every((definition) =>
            definition.code.startsWith(`${metadata.namespace}.`)
        )
    );

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success)
        throw new PermissionError(
            { reason: 'invalid-definition' },
            {
                validationIssues: validationDiagnostics(result.error, input, {
                    fields: { code: {}, name: {}, scope: {}, namespace: {}, definitions: {} },
                }),
            }
        );
    return result.data;
}

export function parseAuthorizationDefinition(input: unknown): AuthorizationDefinition {
    return Object.freeze(parse(definitionSchema, input));
}

export function parseAuthorizationMetadata(input: unknown): AuthorizationMetadata {
    const metadata = parse(metadataSchema, input);
    return Object.freeze({
        ...metadata,
        definitions: Object.freeze(
            metadata.definitions.map((definition) => Object.freeze(definition))
        ),
    });
}
