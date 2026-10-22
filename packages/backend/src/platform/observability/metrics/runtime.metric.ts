import {
    constants,
    monitorEventLoopDelay,
    performance,
    PerformanceObserver,
} from 'node:perf_hooks';
import { metrics } from '@opentelemetry/api';
import { durationAdvice } from './metric.policy.js';

/** Main-thread runtime only; no worker-thread inspector or application payload is collected. */
export function observeRuntimeMetrics(): () => void {
    const meter = metrics.getMeter('talosark.runtime');
    const gc = meter.createHistogram('nodejs.gc.duration', { unit: 's', advice: durationAdvice });
    const kinds = new Map([
        [constants.NODE_PERFORMANCE_GC_MAJOR, 'major'],
        [constants.NODE_PERFORMANCE_GC_MINOR, 'minor'],
        [constants.NODE_PERFORMANCE_GC_INCREMENTAL, 'incremental'],
        [constants.NODE_PERFORMANCE_GC_WEAKCB, 'weakcb'],
    ]);
    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            const detail = (entry as { detail?: { kind?: number } }).detail;
            gc.record(entry.duration / 1000, { type: kinds.get(detail?.kind ?? -1) ?? 'other' });
        }
    });
    observer.observe({ entryTypes: ['gc'] });
    const histogram = monitorEventLoopDelay({ resolution: 20 });
    histogram.enable();
    const delay = meter.createObservableGauge('nodejs.eventloop.delay', { unit: 's' });
    const utilization = meter.createObservableGauge('nodejs.eventloop.utilization', { unit: '1' });
    let previous = performance.eventLoopUtilization();
    let sample: { mean: number; max: number; p99: number; utilization: number } | undefined;
    // Sampling has its own fixed window, independent of exporter scheduling or forceFlush calls.
    const timer = setInterval(() => {
        const current = performance.eventLoopUtilization();
        sample = {
            mean: histogram.mean / 1e9,
            max: histogram.max / 1e9,
            p99: histogram.percentile(99) / 1e9,
            utilization: performance.eventLoopUtilization(current, previous).utilization,
        };
        previous = current;
        histogram.reset();
    }, 10_000);
    timer.unref();
    const delayCallback: Parameters<typeof delay.addCallback>[0] = (result) => {
        if (!sample) return;
        for (const type of ['mean', 'max', 'p99'] as const) {
            if (Number.isFinite(sample[type])) result.observe(sample[type], { type });
        }
    };
    const utilizationCallback: Parameters<typeof utilization.addCallback>[0] = (result) => {
        if (sample && Number.isFinite(sample.utilization)) result.observe(sample.utilization);
    };
    delay.addCallback(delayCallback);
    utilization.addCallback(utilizationCallback);
    return () => {
        clearInterval(timer);
        observer.disconnect();
        histogram.disable();
        delay.removeCallback(delayCallback);
        utilization.removeCallback(utilizationCallback);
    };
}
