import { metrics } from '@opentelemetry/api';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';

const meter = metrics.getMeter('talosark.audit');
const calls = meter.createCounter('audit.operations');
const duration = meter.createHistogram('audit.operation.duration', {
    unit: 's',
    advice: durationAdvice,
});

/** Append returning does not establish that the caller's business transaction committed. */
export function observeAudit<T>(operation: 'append' | 'list', work: () => Promise<T>): Promise<T> {
    return withSpan('audit.operation', { operation }, async () => {
        const started = performance.now();
        let outcome = 'returned';
        try {
            return await work();
        } catch (error) {
            outcome = 'error';
            throw error;
        } finally {
            calls.add(1, { operation, outcome });
            duration.record((performance.now() - started) / 1000, { operation, outcome });
        }
    });
}
