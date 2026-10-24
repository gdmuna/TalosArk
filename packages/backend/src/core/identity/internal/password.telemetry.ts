import { metrics } from '@opentelemetry/api';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';

const meter = metrics.getMeter('talosark.identity.password');
const operations = meter.createCounter('identity.password.operations');
const active = meter.createUpDownCounter('identity.password.active');
const duration = meter.createHistogram('identity.password.duration', {
    unit: 's',
    advice: durationAdvice,
});

/** Observes hashing work, not whether an account exists or a login ultimately succeeds. */
export function observePassword<T>(
    operation: 'initialize' | 'hash' | 'verify',
    work: () => Promise<T>
): Promise<T> {
    return withSpan('identity.password', { operation }, async () => {
        const started = performance.now();
        let outcome = 'success';
        active.add(1, { operation });
        try {
            return await work();
        } catch (error) {
            outcome = 'error';
            throw error;
        } finally {
            active.add(-1, { operation });
            operations.add(1, { operation, outcome });
            duration.record((performance.now() - started) / 1000, { operation, outcome });
        }
    });
}
