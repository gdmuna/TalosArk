import { metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';
import { MailError } from './mail.error.js';
import type { MailSendResult } from './mail.contract.js';

const meter = metrics.getMeter('talosark.mail');
const operations = meter.createCounter('mail.operations');
const active = meter.createUpDownCounter('mail.active');
const duration = meter.createHistogram('mail.operation.duration', {
    unit: 's',
    advice: durationAdvice,
});

/** SMTP acceptance is not delivery. Never capture recipients, content or provider replies. */
export function observeMailOperation<T extends MailSendResult | void>(
    operation: 'send' | 'verify' | 'close',
    work: () => Promise<T>
): Promise<T> {
    return withSpan(
        'mail.operation',
        { operation },
        async () => {
            const started = performance.now();
            let outcome = 'success';
            let phase: string | undefined;
            let reason: string | undefined;
            let acceptance: string | undefined;
            active.add(1, { operation });
            try {
                const result = await work();
                if (result) outcome = result.status;
                if (outcome === 'partial')
                    trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
                return result;
            } catch (error) {
                outcome = 'error';
                if (MailError.is(error)) {
                    phase = error.failure.phase;
                    reason = error.failure.reason;
                    acceptance = error.failure.outcome;
                } else reason = 'unexpected';
                throw error;
            } finally {
                const attributes = {
                    operation,
                    outcome,
                    phase,
                    'error.type': reason,
                    'mail.acceptance': acceptance,
                };
                trace.getActiveSpan()?.setAttributes(attributes);
                active.add(-1, { operation });
                operations.add(1, attributes);
                duration.record((performance.now() - started) / 1000, attributes);
            }
        },
        { kind: operation === 'close' ? SpanKind.INTERNAL : SpanKind.CLIENT }
    );
}
