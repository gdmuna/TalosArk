import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { z } from 'zod';
import { RESOURCE_KINDS } from '@/core/resource/index.js';
import { ExtensionDiscovery } from '@/platform/extensions/discovery/index.js';
import {
    createExtensionIndex,
    type ExtensionEntry,
    type ExtensionIndex,
} from '@/platform/extensions/index.js';
import { validationDiagnostics } from '@/platform/error/error.validation.js';
import { purposeTargetSchema } from '../internal/file.input.js';
import { FileError } from '../file.error.js';
import { filePurposePoint } from './file-purpose.decorator.js';
import type {
    FilePurposeDefinition,
    FilePurposeProvider,
    RegisteredFilePurpose,
} from './file-purpose.definition.js';

const definitionSchema = z.strictObject({
    key: purposeTargetSchema.shape.purposeKey,
    resourceKind: z.enum(RESOURCE_KINDS),
    maxSizeBytes: z.number().int().min(1).max(5_000_000_000),
    formats: z
        .record(
            z.string().regex(/^[a-z0-9]{1,16}$/),
            z
                .array(
                    z
                        .string()
                        .max(127)
                        .regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/)
                )
                .min(1)
                .max(10)
        )
        .refine((formats) => Object.keys(formats).length > 0 && Object.keys(formats).length <= 100),
});

function parseDefinition(input: unknown): FilePurposeDefinition {
    const result = definitionSchema.safeParse(input);
    if (!result.success)
        throw new FileError(
            { reason: 'invalid-purpose' },
            { validationIssues: validationDiagnostics(result.error, input) }
        );
    return Object.freeze({
        ...result.data,
        formats: Object.freeze(
            Object.fromEntries(
                Object.entries(result.data.formats).map(([extension, types]) => [
                    extension,
                    Object.freeze(types),
                ])
            )
        ),
    });
}

type Entry = ExtensionEntry<string, RegisteredFilePurpose>;

@Injectable()
export class FilePurposeRegistry implements OnApplicationBootstrap {
    private state: 'pending' | 'preparing' | 'ready' | 'failed' = 'pending';
    private index?: ExtensionIndex<Entry>;

    constructor(private readonly discovery: ExtensionDiscovery) {}

    onApplicationBootstrap(): void {
        if (this.state !== 'pending') throw new FileError({ reason: 'invalid-purpose' });
        this.state = 'preparing';
        try {
            const entries: Entry[] = this.discovery
                .collect(filePurposePoint, parseDefinition)
                .map((entry) => {
                    if (entry.target.kind !== 'provider')
                        throw new FileError({ reason: 'invalid-purpose' });
                    const provider = entry.target.instance as Partial<FilePurposeProvider>;
                    if (
                        typeof provider.authorize !== 'function' ||
                        typeof provider.recordChange !== 'function'
                    )
                        throw new FileError({ reason: 'invalid-purpose' });
                    return {
                        key: entry.metadata.key,
                        source: entry.source,
                        value: Object.freeze({
                            definition: entry.metadata,
                            provider: Object.freeze({
                                authorize: provider.authorize.bind(provider),
                                recordChange: provider.recordChange.bind(provider),
                            }),
                        }),
                    };
                });
            this.index = createExtensionIndex(entries);
            this.state = 'ready';
        } catch (error) {
            this.state = 'failed';
            throw error;
        }
    }

    require(key: string): RegisteredFilePurpose {
        if (this.state !== 'ready' || !this.index)
            throw new FileError({ reason: 'purpose-not-ready' });
        const purpose = this.index.find(key);
        if (!purpose) throw new FileError({ reason: 'unknown-purpose' });
        return purpose;
    }
}
