import type { DefinedError, ErrorClass } from './error.factory.js';

type ErrorHandlers<F extends { reason: string }> = {
    [Reason in F['reason']]?: (
        error: DefinedError<Extract<F, { reason: Reason }> | (F & { reason: Reason })>
    ) => unknown;
};

type HandlerResult<H> = {
    [K in keyof H]: H[K] extends (error: never) => infer R ? Awaited<R> : never;
}[keyof H];

export async function catchError<
    T,
    F extends { reason: string },
    const H extends ErrorHandlers<NoInfer<F>>,
>(
    operation: () => T | PromiseLike<T>,
    source: ErrorClass<F>,
    handlers: H & Record<Exclude<keyof H, F['reason']>, never>
): Promise<T | HandlerResult<H>> {
    let caught: unknown;
    try {
        return await operation();
    } catch (error) {
        caught = error;
    }
    if (source.is(caught) && Object.hasOwn(handlers, caught.failure.reason)) {
        const table: ErrorHandlers<F> = handlers;
        const handler = table[caught.failure.reason as F['reason']];
        if (handler) return (await handler(caught as never)) as HandlerResult<H>;
    }
    throw caught;
}
