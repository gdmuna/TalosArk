import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import { z } from 'zod';
import { validationDiagnostics } from '@/platform/error/error.validation.js';
import { FileError } from './file.error.js';

export const FILE_OPTIONS = Symbol('file.options');

export interface FileOptions {
    readonly stagingBucket: string;
    readonly privateBucket: string;
    readonly maxFileSizeBytes?: number;
    readonly partSizeBytes?: number;
    readonly uploadTtlSeconds?: number;
    readonly unboundTtlSeconds?: number;
    readonly presignTtlSeconds?: number;
    readonly downloadTtlSeconds?: number;
    readonly operationTimeoutMs?: number;
    readonly maxConcurrentOperations?: number;
    readonly closeTimeoutMs?: number;
}

export interface FileModuleAsyncOptions {
    readonly imports?: ModuleMetadata['imports'];
    readonly inject?: FactoryProvider['inject'];
    readonly useFactory: FactoryProvider<FileOptions>['useFactory'];
}

const seconds = (fallback: number) => z.number().int().min(1).max(604800).default(fallback);
const bucket = z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const schema = z.strictObject({
    stagingBucket: bucket,
    privateBucket: bucket,
    maxFileSizeBytes: z
        .number()
        .int()
        .min(1)
        .max(5_000_000_000)
        .default(100 * 1024 ** 2),
    partSizeBytes: z
        .number()
        .int()
        .min(5 * 1024 ** 2)
        .max(256 * 1024 ** 2)
        .default(8 * 1024 ** 2),
    uploadTtlSeconds: seconds(3600),
    unboundTtlSeconds: seconds(86400),
    presignTtlSeconds: seconds(600),
    downloadTtlSeconds: seconds(60),
    operationTimeoutMs: z.number().int().min(100).max(600_000).default(120_000),
    maxConcurrentOperations: z.number().int().min(1).max(32).default(4),
    closeTimeoutMs: z.number().int().min(1).max(30_000).default(5000),
});

export type ResolvedFileOptions = Readonly<z.output<typeof schema>>;

export function resolveFileOptions(input: FileOptions): ResolvedFileOptions {
    const result = schema.safeParse(input);
    if (!result.success)
        throw new FileError(
            { reason: 'configuration' },
            {
                validationIssues: validationDiagnostics(result.error, input, {
                    fields: Object.fromEntries(
                        Object.keys(schema.shape).map((key) => [key, { scalar: true }])
                    ),
                }),
            }
        );
    return Object.freeze(result.data);
}
