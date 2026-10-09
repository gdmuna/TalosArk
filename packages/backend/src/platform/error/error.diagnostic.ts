import type { ResolvedError } from './error.resolver.js';

const safeLabel = (value: unknown) =>
    typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value) ? value : undefined;

// Vendor errors can contain tokens, SQL parameters or complete request/response bodies.
// Keep structural diagnostics and stack frames, never arbitrary messages or properties.
export function serializeError(error: unknown): unknown {
    const seen = new WeakSet<object>();
    let remaining = 32;
    function visit(value: unknown, depth: number): unknown {
        if (!(value instanceof Error)) return { type: 'NonErrorThrown' };
        if (seen.has(value)) return { type: 'CircularCause' };
        if (depth >= 8) return { type: 'CauseDepthLimit' };
        if (remaining-- <= 0) return { type: 'ErrorCountLimit' };
        seen.add(value);
        const failure =
            'failure' in value && value.failure && typeof value.failure === 'object'
                ? value.failure
                : undefined;
        const heading = value.message ? `${value.name}: ${value.message}` : value.name;
        const stack = value.stack?.startsWith(heading)
            ? value.stack.slice(heading.length)
            : undefined;
        return {
            type: safeLabel(value.name) ?? 'Error',
            code:
                'code' in value
                    ? safeLabel(value.code)
                    : 'errorCode' in value
                      ? safeLabel(value.errorCode)
                      : undefined,
            reason: failure && 'reason' in failure ? safeLabel(failure.reason) : undefined,
            operation: failure && 'operation' in failure ? safeLabel(failure.operation) : undefined,
            upstreamStatus:
                failure && 'upstreamStatus' in failure && typeof failure.upstreamStatus === 'number'
                    ? failure.upstreamStatus
                    : undefined,
            stack: stack
                ?.split('\n')
                .filter((line) => /^\s+at /.test(line))
                .slice(0, 30)
                .join('\n'),
            ...(value.cause === undefined ? {} : { cause: visit(value.cause, depth + 1) }),
            ...(value instanceof AggregateError
                ? {
                      errors: value.errors
                          .slice(0, 4)
                          .map((entry: unknown) => visit(entry, depth + 1)),
                  }
                : {}),
        };
    }
    return error === undefined ? undefined : visit(error, 0);
}

export function createErrorDiagnostic(error: ResolvedError) {
    return {
        level: error.definition.internal?.logLevel ?? 'error',
        message: error.public.message,
        data: {
            code: error.public.code,
            error: serializeError(error.original),
            resolutionError: serializeError(error.resolutionError),
        },
    };
}
