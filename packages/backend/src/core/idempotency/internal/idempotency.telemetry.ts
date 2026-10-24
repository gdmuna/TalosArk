import { metrics, trace } from '@opentelemetry/api';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';
import { IdempotencyError } from '../idempotency.error.js';
import type { IdempotencyExecution } from '../idempotency.types.js';

const meter = metrics.getMeter('talosark.idempotency');
const requests = meter.createCounter('idempotency.requests');
const duration = meter.createHistogram('idempotency.request.duration', {
    unit: 's',
    advice: durationAdvice,
});

/** Results remain provisional until the caller's surrounding transaction commits. */
export function observeIdempotency<T>(work: () => Promise<IdempotencyExecution<T>>) {
    return withSpan('idempotency.run', {}, async () => {
        const started = performance.now();
        let outcome = 'unexpected';
        try {
            const result = await work();
            outcome = result.kind;
            return result;
        } catch (error) {
            if (IdempotencyError.is(error)) outcome = error.failure.reason;
            throw error;
        } finally {
            trace.getActiveSpan()?.setAttribute('outcome', outcome);
            requests.add(1, { outcome });
            duration.record((performance.now() - started) / 1000, { outcome });
        }
    });
}
