import { metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';
import { HttpError } from './http.error.js';
import type { HttpResponse } from './type.js';

const meter = metrics.getMeter('talosark.http.outbound');
const calls = meter.createCounter('http.outbound.calls', { unit: '{call}' });
const active = meter.createUpDownCounter('http.outbound.active');
const waiters = meter.createUpDownCounter('http.outbound.waiters');
const waitDuration = meter.createHistogram('http.outbound.wait.duration', {
    unit: 's',
    advice: durationAdvice,
});
const callDuration = meter.createHistogram('http.outbound.duration', {
    unit: 's',
    advice: durationAdvice,
});
const attempts = meter.createCounter('http.outbound.attempts', { unit: '{attempt}' });
const retries = meter.createCounter('http.outbound.retries', { unit: '{attempt}' });
const attemptDuration = meter.createHistogram('http.outbound.attempt.duration', {
    unit: 's',
    advice: durationAdvice,
});

export function observeHttpCall<T>(
    upstream: string,
    operation: string,
    work: () => PromiseLike<T>
) {
    const labels = { upstream, operation };
    return withSpan('http.outbound', labels, async () => {
        const start = performance.now();
        let outcome = 'success';
        active.add(1, labels);
        try {
            return await work();
        } catch (error) {
            outcome = error instanceof HttpError ? error.failure.reason : 'unexpected';
            throw error;
        } finally {
            const attributes = { ...labels, outcome };
            calls.add(1, attributes);
            active.add(-1, labels);
            callDuration.record((performance.now() - start) / 1000, attributes);
        }
    });
}

export function observeHttpWait<T>(
    upstream: string,
    operation: string,
    phase: 'credential' | 'send-slot',
    work: () => Promise<T>
): Promise<T> {
    const labels = { upstream, operation, phase };
    return withSpan('http.outbound.wait', labels, async () => {
        const start = performance.now();
        let outcome = 'success';
        waiters.add(1, labels);
        try {
            return await work();
        } catch (error) {
            outcome = 'error';
            throw error;
        } finally {
            waiters.add(-1, labels);
            waitDuration.record((performance.now() - start) / 1000, { ...labels, outcome });
        }
    });
}

export function observeHttpAttempt(
    upstream: string,
    operation: string,
    method: string,
    attempt: number,
    work: () => Promise<HttpResponse>
) {
    const labels = { upstream, operation, 'http.request.method': method };
    return withSpan(
        'http.outbound.attempt',
        labels,
        async () => {
            const start = performance.now();
            let status = 0;
            let outcome = 'error';
            if (attempt > 1) retries.add(1, labels);
            try {
                const response = await work();
                status = response.status;
                outcome = status >= 400 ? 'http-error' : 'success';
                trace.getActiveSpan()?.setAttribute('http.response.status_code', status);
                if (status >= 400) trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
                return response;
            } finally {
                const attributes = { ...labels, outcome, 'http.response.status_code': status };
                attempts.add(1, attributes);
                attemptDuration.record((performance.now() - start) / 1000, attributes);
            }
        },
        { kind: SpanKind.CLIENT }
    );
}
