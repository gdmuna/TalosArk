import { metrics } from '@opentelemetry/api';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';

const meter = metrics.getMeter('talosark.task.queue');
const operations = meter.createCounter('task.queue.operations');
const duration = meter.createHistogram('task.queue.operation.duration', {
    unit: 's',
    advice: durationAdvice,
});
const dispositions = meter.createCounter('task.queue.dispatch.outcomes');
const connections = meter.createCounter('task.queue.connection.events');
const connectionReady = meter.createGauge('task.queue.connection.ready');
const deliveries = meter.createCounter('task.queue.delivery.events');
const claimed = meter.createCounter('task.queue.claimed');

export function observeQueueOperation<T>(
    operation: 'dispatch' | 'poll' | 'start' | 'stop',
    work: () => Promise<T>
): Promise<T> {
    const run = async () => {
        const started = performance.now();
        let outcome = 'success';
        try {
            return await work();
        } catch (error) {
            outcome = 'error';
            throw error;
        } finally {
            operations.add(1, { operation, outcome });
            duration.record((performance.now() - started) / 1000, { operation, outcome });
        }
    };
    // Empty periodic polls should not create a constant background stream of root spans.
    return operation === 'dispatch' ? withSpan('task.queue.operation', { operation }, run) : run();
}

export const recordDispatchOutcome = (
    outcome:
        | 'published'
        | 'existing'
        | 'reconciled-failed'
        | 'reconciled-review'
        | 'lease-active'
        | 'expired'
        | 'handler-unavailable'
        | 'exhausted'
        | 'interrupted'
) => dispositions.add(1, { outcome });
export const recordQueueConnection = (
    type: 'blocking' | 'command',
    operation: 'created' | 'ready' | 'reconnecting' | 'error' | 'closed'
) => {
    connections.add(1, { type, operation });
    connectionReady.record(operation === 'ready' ? 1 : 0, { type });
};
export const recordQueueDelivery = (
    outcome: 'failed' | 'stalled' | 'worker-error' | 'queue-error' | 'worker-stopped'
) => deliveries.add(1, { outcome });
export const recordQueueClaimed = (count: number) => claimed.add(count);
