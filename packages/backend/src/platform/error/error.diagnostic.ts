import type { ResolvedError } from './error.resolver.js';
import { definedErrorId } from './error.factory.js';

export interface ErrorDiagnosticProjection {
    message?: string;
    operation?: string;
    address?: string;
    port?: number;
    syscall?: string;
}

export type ErrorDiagnosticProjector = (error: Error) => ErrorDiagnosticProjection | undefined;

export interface ErrorDiagnostic extends ErrorDiagnosticProjection {
    type: string;
    id?: string;
    code?: string;
    reason?: string;
    upstreamStatus?: number;
    stack?: string;
    cause?: ErrorDiagnostic;
    errors?: ErrorDiagnostic[];
    errorsOmitted?: number;
    stackFramesOmitted?: number;
}

const safeLabel = (value: unknown) =>
    typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value) ? value : undefined;

// Vendor errors can contain tokens, SQL parameters or complete request/response bodies.
// Owner projections may add bounded, explicitly approved diagnostics, never raw SDK data.
export function serializeError(
    error: unknown,
    project?: ErrorDiagnosticProjector
): ErrorDiagnostic | undefined {
    const seen = new WeakSet<object>();
    let remaining = 32;
    function visit(value: unknown, depth: number): ErrorDiagnostic {
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
        const frames = stack?.split('\n').filter((line) => /^\s+at /.test(line));
        const id = definedErrorId(value);
        let projection: ErrorDiagnosticProjection | undefined;
        try {
            projection = project?.(value);
        } catch {
            // Optional diagnostics must not prevent recording the underlying failure.
        }
        const port = projection?.port;
        return {
            type: safeLabel(value.name) ?? 'Error',
            id,
            message:
                projection?.message?.slice(0, 400) ?? (id ? `Operation failed: ${id}` : undefined),
            code:
                'code' in value
                    ? safeLabel(value.code)
                    : 'errorCode' in value
                      ? safeLabel(value.errorCode)
                      : undefined,
            reason: failure && 'reason' in failure ? safeLabel(failure.reason) : undefined,
            operation:
                safeLabel(projection?.operation) ??
                (failure && 'operation' in failure ? safeLabel(failure.operation) : undefined),
            address: projection?.address?.slice(0, 255),
            port:
                typeof port === 'number' && Number.isInteger(port) && port >= 0 && port <= 65535
                    ? port
                    : undefined,
            syscall: safeLabel(projection?.syscall),
            upstreamStatus:
                failure && 'upstreamStatus' in failure && typeof failure.upstreamStatus === 'number'
                    ? failure.upstreamStatus
                    : undefined,
            stack: frames?.slice(0, 30).join('\n'),
            ...(frames && frames.length > 30 ? { stackFramesOmitted: frames.length - 30 } : {}),
            ...(value.cause === undefined ? {} : { cause: visit(value.cause, depth + 1) }),
            ...(value instanceof AggregateError
                ? {
                      errors: value.errors
                          .slice(0, 4)
                          .map((entry: unknown) => visit(entry, depth + 1)),
                      ...(value.errors.length > 4
                          ? { errorsOmitted: value.errors.length - 4 }
                          : {}),
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
