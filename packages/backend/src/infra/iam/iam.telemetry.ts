import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';
import { withSpan, withSpanSync } from '@/platform/observability/tracing/trace.span.js';
import { IamError } from './iam.error.js';
import jwt from 'jsonwebtoken';

type IamOperation = 'resolve-identity' | 'exchange-code' | 'refresh-token' | 'introspect-token';
const meter = metrics.getMeter('talosark.iam');
const operations = meter.createCounter('iam.operations');
const duration = meter.createHistogram('iam.operation.duration', {
    unit: 's',
    advice: durationAdvice,
});

function record(operation: string, started: number, outcome: string) {
    const attributes = { operation, outcome };
    operations.add(1, attributes);
    duration.record((performance.now() - started) / 1000, attributes);
    trace.getActiveSpan()?.setAttributes(attributes);
    if (outcome !== 'success') trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
}

export function observeIamOperation<T>(
    operation: IamOperation,
    work: () => PromiseLike<T>
): Promise<T> {
    return withSpan('iam.operation', { operation }, async () => {
        const started = performance.now();
        let outcome = 'success';
        try {
            return await work();
        } catch (error) {
            outcome = IamError.is(error) ? error.failure.reason : 'unexpected';
            throw error;
        } finally {
            record(operation, started, outcome);
        }
    });
}

/** Invalid tokens return false/null by contract, but still count as rejected verification. */
export function observeIamVerification<T>(
    operation: 'verify-access-token' | 'verify-id-token' | 'verify-signature',
    work: () => T,
    accepted: (value: T) => boolean
): T {
    return withSpanSync('iam.verify', { operation }, () => {
        const started = performance.now();
        let outcome = 'unexpected';
        try {
            const value = work();
            outcome = accepted(value) ? 'success' : 'rejected';
            return value;
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) outcome = 'rejected';
            throw error;
        } finally {
            record(operation, started, outcome);
        }
    });
}
