import type { DefinedError, ErrorClass } from './error.factory.js';

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
