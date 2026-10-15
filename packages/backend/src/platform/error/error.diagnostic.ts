import type { ResolvedError } from './error.resolver.js';
import { definedErrorDiagnostic } from './error.factory.js';
import { ConfigurationError, type ValidationDiagnosticIssue } from './error.validation.js';
import type {
    ErrorDiagnosticProjector,
    ErrorDiagnosticProjection,
} from '../observability/logger/logger.diagnostic.js';

export interface ErrorDiagnostic {
    type: string;
    message?: string;
    id?: string;
    code?: string;
    reason?: string;
    stack?: string;
    cause?: ErrorDiagnostic;
    errors?: ErrorDiagnostic[];
    errorsOmitted?: number;
    stackFramesOmitted?: number;
    validationIssues?: readonly ValidationDiagnosticIssue[];
    readonly [field: string]: unknown;
}

const safeLabel = (value: unknown) =>
    typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value) ? value : undefined;

const reserved = new Set([
    'type',
    'id',
    'code',
    'reason',
    'stack',
    'cause',
    'errors',
    'errorsOmitted',
    'stackFramesOmitted',
    'validationIssues',
    'name',
    'pid',
    'hostname',
    'time',
    'level',
    'msg',
    'context',
    'event',
    '__proto__',
    'constructor',
    'prototype',
    'toJSON',
]);
const unsafeKey = new Set(['__proto__', 'constructor', 'prototype', 'toJSON']);
// eslint-disable-next-line no-control-regex -- Strip terminal control bytes from diagnostics.
const terminalControls = /[\u0000-\u001f\u007f-\u009f]/g;

function projectionSnapshotter() {
    let fields = 128;
    let characters = 8192;
    const seen = new WeakSet<object>();
    const snapshot = (value: unknown, depth: number): unknown => {
        if (value === null || typeof value === 'boolean') return value;
        if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
        if (typeof value === 'string') {
            const text = value.slice(0, Math.min(512, characters)).replace(terminalControls, '');
            characters -= text.length;
            return text;
        }
        if (!value || typeof value !== 'object' || depth >= 4 || seen.has(value)) return undefined;
        const prototype = Object.getPrototypeOf(value);
        if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
            return undefined;
        seen.add(value);
        const output: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};
        const keys = Array.isArray(value)
            ? Array.from({ length: Math.min(value.length, 16) }, (_, i) => String(i))
            : Object.keys(value).slice(0, 32);
        for (const key of keys) {
            if (fields-- <= 0) break;
            if (unsafeKey.has(key) || !safeLabel(key)) continue;
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            const data =
                descriptor && 'value' in descriptor
                    ? snapshot(descriptor.value, depth + 1)
                    : undefined;
            if (Array.isArray(output)) output.push(data ?? null);
            else if (data !== undefined) output[key] = data;
        }
        seen.delete(value);
        return output;
    };
    return (projection: ErrorDiagnosticProjection | undefined): Record<string, unknown> => {
        const output: Record<string, unknown> = {};
        if (!projection) return output;
        const prototype = Object.getPrototypeOf(projection);
        if (prototype !== Object.prototype && prototype !== null) return output;
        for (const key of Object.keys(projection).slice(0, 32)) {
            if (fields-- <= 0) break;
            if (reserved.has(key) || !safeLabel(key)) continue;
            const descriptor = Object.getOwnPropertyDescriptor(projection, key);
            const data =
                descriptor && 'value' in descriptor ? snapshot(descriptor.value, 0) : undefined;
            if (data !== undefined && (key !== 'message' || typeof data === 'string'))
                output[key] = data;
        }
        return output;
    };
}

// Vendor errors can contain tokens, SQL parameters or complete request/response bodies.
// Owner projections may add bounded, explicitly approved diagnostics, never raw SDK data.
export function serializeError(
    error: unknown,
    project?: ErrorDiagnosticProjector
): ErrorDiagnostic | undefined {
    const seen = new WeakSet<object>();
    let remaining = 32;
    const snapshotProjection = projectionSnapshotter();
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
        const approved = definedErrorDiagnostic(value);
        const id = approved?.id;
        const configuration = value instanceof ConfigurationError ? value : undefined;
        let projection: Record<string, unknown> = {};
        try {
            projection = snapshotProjection(project?.(value));
        } catch {
            // Optional diagnostics must not prevent recording the underlying failure.
        }
        return {
            ...projection,
            type: safeLabel(value.name) ?? 'Error',
            id,
            message:
                (typeof projection.message === 'string'
                    ? projection.message.slice(0, 400)
                    : undefined) ??
                approved?.message.slice(0, 400) ??
                configuration?.summary,
            validationIssues: approved?.validationIssues ?? configuration?.validationIssues,
            code:
                'code' in value
                    ? safeLabel(value.code)
                    : 'errorCode' in value
                      ? safeLabel(value.errorCode)
                      : undefined,
            reason: failure && 'reason' in failure ? safeLabel(failure.reason) : undefined,
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

export function createErrorDiagnostic(error: ResolvedError, project?: ErrorDiagnosticProjector) {
    return {
        level: error.definition.internal?.logLevel ?? 'error',
        message: error.public.message,
        data: {
            code: error.public.code,
            error: serializeError(error.original, project),
            resolutionError: serializeError(error.resolutionError, project),
        },
    };
}
