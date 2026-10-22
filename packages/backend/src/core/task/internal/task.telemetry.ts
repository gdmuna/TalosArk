import { metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';
import { sourceTraceLink } from '@/platform/observability/tracing/trace.context.js';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';

const meter = metrics.getMeter('talosark.task');
const executions = meter.createCounter('task.executions');
const retries = meter.createCounter('task.retries');
const active = meter.createUpDownCounter('task.active');
const duration = meter.createHistogram('task.execution.duration', {
    unit: 's',
    advice: {
        explicitBucketBoundaries: [
            ...durationAdvice.explicitBucketBoundaries,
            60,
            120,
            300,
            600,
            1800,
            3600,
        ],
    },
});

type Outcome = 'succeeded' | 'retry' | 'failed' | 'needs_review' | 'unconfirmed';

/** Count acquired attempts, not duplicate deliveries, and only claim results confirmed in SQL. */
export function observeTaskExecution<T>(
    source: {
        kind: string;
        attempts: number;
        traceParent: string | null;
        traceState: string | null;
    },
    work: (settled: (outcome: Outcome) => void) => Promise<T>
): Promise<T> {
    const link = sourceTraceLink(source);
    return withSpan(
        'task.execute',
        { 'task.kind': source.kind, 'task.attempt': source.attempts },
        async () => {
            const started = performance.now();
            const result: { outcome: Outcome } = { outcome: 'unconfirmed' };
            active.add(1, { 'task.kind': source.kind });
            try {
                return await work((value) => {
                    result.outcome = value;
                });
            } finally {
                const { outcome } = result;
                const attributes = { 'task.kind': source.kind, outcome };
                active.add(-1, { 'task.kind': source.kind });
                executions.add(1, attributes);
                duration.record((performance.now() - started) / 1000, attributes);
                if (outcome === 'retry') retries.add(1, { 'task.kind': source.kind });
                const span = trace.getActiveSpan();
                span?.setAttribute('outcome', outcome);
                if (outcome !== 'succeeded') span?.setStatus({ code: SpanStatusCode.ERROR });
            }
        },
        { root: true, kind: SpanKind.CONSUMER, links: link ? [link] : [] }
    );
}
