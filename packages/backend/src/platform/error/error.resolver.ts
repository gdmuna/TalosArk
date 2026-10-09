import {
    PublicErrorSchema,
    type PublicError,
    type ErrorCatalog,
    type ErrorDefinition,
    type ErrorContract,
} from '@talos-ark/contracts/protocol';
import { SystemErrorDefinition } from '@talos-ark/contracts/backend';
import { definedErrorId, type DefinedError } from './error.factory.js';

export interface ResolvedError {
    readonly definition: ErrorDefinition & { readonly public: ErrorContract };
    readonly public: PublicError;
    readonly original: unknown;
    readonly resolutionError?: unknown;
}

export class ErrorResolver {
    private readonly definitions = new Map<string, ErrorDefinition>();

    constructor(catalogs: readonly ErrorCatalog[]) {
        const codes = new Set<string>();
        for (const catalog of catalogs) {
            for (const definition of Object.values(catalog)) {
                if (
                    this.definitions.has(definition.id) ||
                    (definition.public && codes.has(definition.public.code))
                )
                    throw new TypeError(`Duplicate error definition: ${definition.id}`);
                this.definitions.set(definition.id, definition);
                if (definition.public) codes.add(definition.public.code);
            }
        }
    }

    resolve(error: unknown): ResolvedError {
        try {
            const id = definedErrorId(error);
            const definition = id === undefined ? undefined : this.definitions.get(id);
            if (!definition?.public) return this.internal(error);
            const details = definition.public.details.parse((error as DefinedError).details);
            const publicError = PublicErrorSchema.parse({
                code: definition.public.code,
                message: definition.public.message,
                details,
            });
            JSON.stringify(publicError);
            return {
                definition: { ...definition, public: definition.public },
                public: publicError,
                original: error,
            };
        } catch (resolutionError) {
            return this.internal(error, resolutionError);
        }
    }

    internal(original: unknown, resolutionError?: unknown): ResolvedError {
        const definition = SystemErrorDefinition.internal;
        return {
            definition,
            public: {
                code: definition.public.code,
                message: definition.public.message,
                details: null,
            },
            original,
            ...(resolutionError === undefined ? {} : { resolutionError }),
        };
    }
}
