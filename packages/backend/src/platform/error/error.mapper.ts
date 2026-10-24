import type { DefinedError, ErrorClass } from './error.factory.js';

export type ErrorMapper = (error: unknown) => DefinedError | undefined;

/** Explicit owner-local composition; one match, no cause traversal or global registration. */
export function composeErrorMappers(mappers: readonly ErrorMapper[]) {
    const handlers = [...mappers];
    const map = (error: unknown): unknown => {
        for (const handler of handlers) {
            const mapped = handler(error);
            if (mapped !== undefined) return mapped;
        }
        return error;
    };
    return Object.freeze({
        map,
        async run<T>(operation: () => T | PromiseLike<T>): Promise<T> {
            try {
                return await operation();
            } catch (error) {
                throw map(error);
            }
        },
    });
}

export function defineErrorMapper<
    S extends { reason: string },
    T extends { reason: string },
    A extends unknown[],
>(
    source: ErrorClass<S>,
    target: ErrorClass<T>,
    project: (failure: S, ...args: A) => NoInfer<T> | undefined
) {
    return (error: unknown, ...args: A): DefinedError<T> | undefined => {
        if (!source.is(error)) return undefined;
        const failure = project(error.failure, ...args);
        return failure === undefined ? undefined : new target(failure, { cause: error });
    };
}
