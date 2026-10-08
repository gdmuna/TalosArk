import type { ErrorContract } from '@talos-ark/contracts/protocol';
import type { z } from 'zod';

export interface ErrorDefinition<S extends z.ZodType = z.ZodType> {
    readonly contract: ErrorContract<S>;
    readonly message: string;
    readonly logLevel: 'info' | 'warn' | 'error';
}

export interface ErrorMapping {
    readonly definition: ErrorDefinition;
    readonly details: unknown;
}

export type ErrorMapper = (error: unknown) => ErrorMapping | undefined;

export function mapError<S extends z.ZodType>(
    definition: ErrorDefinition<S>,
    details: z.output<S>
): ErrorMapping {
    return { definition, details };
}
