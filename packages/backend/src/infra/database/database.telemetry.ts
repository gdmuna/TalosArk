import { metrics } from '@opentelemetry/api';
import type { Pool } from 'pg';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';

const meter = metrics.getMeter('talosark.database');
const operations = meter.createCounter('db.client.operations', { unit: '{operation}' });
const duration = meter.createHistogram('db.client.operation.duration', {
    unit: 's',
    advice: durationAdvice,
});
const transactions = meter.createCounter('db.transactions', { unit: '{transaction}' });
const transactionDuration = meter.createHistogram('db.transaction.duration', {
    unit: 's',
    advice: durationAdvice,
});
const connections = meter.createObservableGauge('db.pool.connections', { unit: '{connection}' });
const waiting = meter.createObservableGauge('db.pool.pending', { unit: '{request}' });

export function observeDatabaseOperation<T>(
    model: string | undefined,
    operation: string,
    work: () => PromiseLike<T>
) {
    const labels = {
        'db.system.name': 'postgresql',
        'db.collection.name': model ?? 'raw',
        'db.operation.name': operation,
    };
    return withSpan('database.operation', labels, async () => {
        const start = performance.now();
        let outcome = 'success';
        try {
            return await work();
        } catch (error) {
            outcome = 'error';
            throw error;
        } finally {
            const attributes = { ...labels, outcome };
            operations.add(1, attributes);
            duration.record((performance.now() - start) / 1000, attributes);
        }
    });
}

export function observeDatabaseTransaction<T>(work: () => PromiseLike<T>) {
    return withSpan('database.transaction', {}, async () => {
        const start = performance.now();
        let outcome = 'committed';
        try {
            return await work();
        } catch (error) {
            outcome = 'unconfirmed';
            throw error;
        } finally {
            transactions.add(1, { outcome });
            transactionDuration.record((performance.now() - start) / 1000, { outcome });
        }
    });
}

export function observeDatabasePool(pool: Pool): () => void {
    const observeConnections: Parameters<typeof connections.addCallback>[0] = (result) => {
        result.observe(pool.idleCount, { state: 'idle' });
        result.observe(pool.totalCount - pool.idleCount, { state: 'used' });
        result.observe(pool.options.max ?? 10, { state: 'limit' });
    };
    const observeWaiting: Parameters<typeof waiting.addCallback>[0] = (result) =>
        result.observe(pool.waitingCount);
    connections.addCallback(observeConnections);
    waiting.addCallback(observeWaiting);
    return () => {
        connections.removeCallback(observeConnections);
        waiting.removeCallback(observeWaiting);
    };
}
