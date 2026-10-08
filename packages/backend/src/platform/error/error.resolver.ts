import { PublicErrorSchema, type PublicError } from '@talos-ark/contracts/protocol';
import type { ErrorDefinition, ErrorMapper } from './error.definition.js';
import { RequestErrorDefinition } from './request.error-mapper.js';

export interface ResolvedError {
    readonly definition: ErrorDefinition;
    readonly public: PublicError;
    readonly original: unknown;
    readonly mappingError?: unknown;
}

export class ErrorResolver {
    constructor(private readonly mappers: readonly ErrorMapper[]) {}

    resolve(error: unknown): ResolvedError {
        try {
            for (const mapper of this.mappers) {
                const mapping = mapper(error);
                if (!mapping) continue;
                const details = mapping.definition.contract.details.parse(mapping.details);
                const publicError = PublicErrorSchema.parse({
                    code: mapping.definition.contract.code,
                    message: mapping.definition.message,
                    details,
                });
                // Recursive schemas may accept cycles; wire output must actually serialize.
                JSON.stringify(publicError);
                return { definition: mapping.definition, public: publicError, original: error };
            }
        } catch (mappingError) {
            return this.internal(error, mappingError);
        }
        return this.internal(error);
    }

    internal(original: unknown, mappingError?: unknown): ResolvedError {
        const definition = RequestErrorDefinition.internal;
        return {
            definition,
            public: { code: definition.contract.code, message: definition.message, details: null },
            original,
            ...(mappingError === undefined ? {} : { mappingError }),
        };
    }
}
