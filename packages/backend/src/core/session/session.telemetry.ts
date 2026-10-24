import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';

const meter = metrics.getMeter('talosark.session');
const verifications = meter.createCounter('session.verifications');
const duration = meter.createHistogram('session.verification.duration', {
    unit: 's',
    advice: durationAdvice,
});

export function observeSessionVerification<T>(work: () => Promise<T | null>): Promise<T | null> {
    return withSpan('session.verify', {}, async () => {
        const started = performance.now();
        let outcome = 'error';
        try {
            const result = await work();
            outcome = result === null ? 'rejected' : 'accepted';
            return result;
        } finally {
            verifications.add(1, { outcome });
            duration.record((performance.now() - started) / 1000, { outcome });
            trace.getActiveSpan()?.setAttribute('outcome', outcome);
            if (outcome !== 'accepted')
                trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
        }
    });
}
