import { errorMonitor } from 'node:events';
import type { EventEmitter } from 'node:events';
import { metrics } from '@opentelemetry/api';
import { durationAdvice } from '../metrics/metric.policy.js';

const meter = metrics.getMeter('talosark.logger');
const initializations = meter.createCounter('log.transport.initializations');
const duration = meter.createHistogram('log.transport.startup.duration', {
    unit: 's',
    advice: durationAdvice,
});
const events = meter.createCounter('log.transport.events');
const ready = meter.createGauge('log.transport.ready');
const dropped = meter.createCounter('log.sampling.dropped');

/** Main-thread observation only. Never log an exporter/transport diagnostic through Pino. */
export async function observeLogInitialization<T>(work: () => Promise<T>): Promise<T> {
    const start = performance.now();
    let outcome = 'success';
    try {
        return await work();
    } catch (error) {
        outcome = 'error';
        throw error;
    } finally {
        initializations.add(1, { outcome });
        duration.record((performance.now() - start) / 1000, { outcome });
    }
}

export function observeLogTransport(transport: EventEmitter): void {
    ready.record(0);
    const onReady = () => {
        ready.record(1);
        events.add(1, { operation: 'ready' });
    };
    const onError = () => {
        ready.record(0);
        events.add(1, { operation: 'error' });
    };
    const onClose = () => {
        ready.record(0);
        events.add(1, { operation: 'closed' });
        transport.off('ready', onReady).off(errorMonitor, onError).off('close', onClose);
    };
    transport.once('ready', onReady).on(errorMonitor, onError).once('close', onClose);
}

export function recordSamplingDrop(level: number): void {
    dropped.add(1, { type: level === 10 ? 'trace' : level === 20 ? 'debug' : 'info' });
}
