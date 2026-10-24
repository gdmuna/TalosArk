import { context, metrics, ROOT_CONTEXT } from '@opentelemetry/api';
import { withSpan } from '../observability/tracing/trace.span.js';
import { durationAdvice } from '../observability/metrics/metric.policy.js';

const meter = metrics.getMeter('talosark.websocket');
const connections = meter.createUpDownCounter('ws.connections.active');
const handshakes = meter.createUpDownCounter('ws.handshakes.active');
const queued = meter.createUpDownCounter('ws.messages.pending');
const active = meter.createUpDownCounter('ws.messages.active');
const messages = meter.createCounter('ws.messages', { unit: '{message}' });
const rejected = meter.createCounter('ws.rejections', { unit: '{operation}' });
const timeouts = meter.createCounter('ws.timeouts', { unit: '{operation}' });
const duration = meter.createHistogram('ws.message.duration', {
    unit: 's',
    advice: durationAdvice,
});
const lifetime = meter.createHistogram('ws.connection.duration', {
    unit: 's',
    advice: durationAdvice,
});
const handshakeDuration = meter.createHistogram('ws.handshake.duration', {
    unit: 's',
    advice: durationAdvice,
});

export function observeWsHandshake<T>(work: () => Promise<T>): Promise<T> {
    return context.with(ROOT_CONTEXT, () =>
        withSpan('ws.handshake', {}, async () => {
            const start = performance.now();
            let outcome = 'success';
            try {
                const value = await work();
                if (value === null) outcome = 'rejected';
                return value;
            } catch (error) {
                outcome = 'error';
                throw error;
            } finally {
                handshakeDuration.record((performance.now() - start) / 1000, { outcome });
            }
        })
    );
}

export const recordWsConnections = (delta: number) => connections.add(delta);
export const recordWsHandshakes = (delta: number) => handshakes.add(delta);
export const recordWsPending = (delta: number) => queued.add(delta);
export const recordWsActive = (delta: number) => active.add(delta);
export const recordWsRejection = (
    reason:
        'capacity' | 'authentication' | 'origin' | 'protocol' | 'backpressure' | 'timeout' | 'error'
) => rejected.add(1, { reason });
export const recordWsTimeout = (phase: 'handshake' | 'message') => timeouts.add(1, { phase });
export const recordWsLifetime = (seconds: number) => lifetime.record(seconds);

/** A message is a new operation, not a child of a connection's long-expired handshake. */
export function observeWsOperation<T>(event: string, work: () => Promise<T>): Promise<T> {
    return context.with(ROOT_CONTEXT, () =>
        withSpan('ws.message', { 'ws.event': event }, async () => {
            const start = performance.now();
            let outcome = 'success';
            try {
                return await work();
            } catch (error) {
                outcome = 'error';
                throw error;
            } finally {
                messages.add(1, { event, outcome });
                duration.record((performance.now() - start) / 1000, { event, outcome });
            }
        })
    );
}
