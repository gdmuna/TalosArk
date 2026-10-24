import { metrics, trace, SpanStatusCode } from '@opentelemetry/api';
import { durationAdvice } from './metric.policy.js';

const meter = metrics.getMeter('talosark.lifecycle');
const operations = meter.createCounter('process.lifecycle.operations');
const duration = meter.createHistogram('process.lifecycle.duration', {
    unit: 's',
    advice: durationAdvice,
});
const ready = meter.createGauge('process.ready');

export const recordProcessReadiness = (value: boolean) => ready.record(value ? 1 : 0);

export async function observeLifecycle<T>(
    operation: 'startup' | 'shutdown' | 'http-drain',
    work: () => Promise<T>
): Promise<T> {
    // Do not activate this span: startup creates long-lived timers and server callbacks.
    const span = trace
        .getTracer('talosark.lifecycle')
        .startSpan('process.lifecycle', { attributes: { operation } });
    const started = performance.now();
    let outcome = 'success';
    try {
        return await work();
    } catch (error) {
        outcome = 'error';
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
    } finally {
        operations.add(1, { operation, outcome });
        duration.record((performance.now() - started) / 1000, { operation, outcome });
        span.setAttribute('outcome', outcome);
        span.end();
    }
}
