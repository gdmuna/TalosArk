import {
    defineErrorCatalog,
    type ErrorCatalog,
    type ErrorDefinition,
} from '@talos-ark/contracts/protocol';
import type { z } from 'zod';

type DetailsInput<D> = D extends { public: { details: infer S extends z.ZodType } }
    ? null extends z.output<S>
        ? { details?: z.output<S> }
        : { details: z.output<S> }
    : { details?: never };

export type ErrorFailure<C extends ErrorCatalog> = {
    [R in keyof C & string]: { reason: R } & DetailsInput<C[R]>;
}[keyof C & string];

export interface ErrorRuntimeOptions extends ErrorOptions {
    retryAfterSeconds?: number;
    retryAfterMs?: number;
}

export interface DefinedError<F extends { reason: string } = { reason: string }> extends Error {
    readonly failure: F;
    readonly id: string;
    readonly details: unknown;
    readonly retryAfterSeconds?: number;
    readonly retryAfterMs?: number;
}

export interface ErrorClass<F extends { reason: string }> {
    new (failure: F, options?: ErrorRuntimeOptions): DefinedError<F>;
    is(error: unknown): error is DefinedError<F>;
    is<R extends F['reason']>(
        error: unknown,
        reason: R
    ): error is DefinedError<Extract<F, { reason: R }> | (F & { reason: R })>;
}

const instances = new WeakMap<Error, string>();

export function definedErrorId(error: unknown): string | undefined {
    return error instanceof Error ? instances.get(error) : undefined;
}

export function defineInternalErrorCatalog<
    const Scope extends string,
    const Reasons extends readonly string[],
>(scope: Scope, reasons: Reasons) {
    return defineErrorCatalog(scope, Object.fromEntries(reasons.map((reason) => [reason, {}]))) as {
        readonly [R in Reasons[number]]: ErrorDefinition & {
            readonly reason: R;
            readonly id: `${Scope}.${R}`;
        };
    };
}

export function defineErrorClass<
    const C extends ErrorCatalog,
    F extends { reason: keyof C & string } = { reason: keyof C & string },
>(
    catalog: C,
    options: { name?: string; diagnosticMessage?: (failure: F & ErrorFailure<C>) => string } = {}
): ErrorClass<F & ErrorFailure<C>> {
    type Failure = F & ErrorFailure<C>;
    class DomainError extends Error {
        declare readonly failure: Failure;
        declare readonly id: string;
        declare readonly details: unknown;
        declare readonly retryAfterSeconds?: number;
        declare readonly retryAfterMs?: number;

        constructor(failure: Failure, runtime: ErrorRuntimeOptions = {}) {
            const definition = Object.hasOwn(catalog, failure.reason)
                ? catalog[failure.reason]
                : undefined;
            if (!definition) throw new TypeError(`Unknown error reason: ${failure.reason}`);
            for (const value of [runtime.retryAfterSeconds, runtime.retryAfterMs]) {
                if (value !== undefined && (!Number.isFinite(value) || value < 0))
                    throw new TypeError('Invalid error retry delay');
            }
            super(
                options.diagnosticMessage?.(failure) ?? `Operation failed: ${definition.id}`,
                runtime
            );
            this.name = options.name ?? 'DomainError';
            Object.defineProperties(this, {
                failure: { value: Object.freeze({ ...failure }) },
                id: { value: definition.id },
                details: { value: 'details' in failure ? failure.details : null },
                retryAfterSeconds: { value: runtime.retryAfterSeconds },
                retryAfterMs: { value: runtime.retryAfterMs },
            });
            instances.set(this, definition.id);
        }

        static is(error: unknown, reason?: string): error is DomainError {
            return (
                error instanceof DomainError &&
                instances.has(error) &&
                (reason === undefined || error.failure.reason === reason)
            );
        }
    }
    return DomainError;
}
