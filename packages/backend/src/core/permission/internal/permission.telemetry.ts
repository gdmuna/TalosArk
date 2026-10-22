import { metrics } from '@opentelemetry/api';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';
import type { PermissionDecision } from '../permission.contract.js';

const meter = metrics.getMeter('talosark.permission');
const evaluations = meter.createCounter('permission.engine.evaluations');
const decisions = meter.createCounter('permission.engine.decisions');
const duration = meter.createHistogram('permission.engine.duration', {
    unit: 's',
    advice: durationAdvice,
});

export function observePermissionEvaluation(work: () => Promise<readonly PermissionDecision[]>) {
    return withSpan('permission.evaluate', {}, async () => {
        const started = performance.now();
        let outcome = 'success';
        try {
            const result = await work();
            let allowed = 0;
            for (const decision of result) if (decision.allowed) allowed++;
            if (allowed) decisions.add(allowed, { outcome: 'allowed' });
            if (result.length > allowed)
                decisions.add(result.length - allowed, { outcome: 'denied' });
            return result;
        } catch (error) {
            outcome = 'error';
            throw error;
        } finally {
            evaluations.add(1, { outcome });
            duration.record((performance.now() - started) / 1000, { outcome });
        }
    });
}
