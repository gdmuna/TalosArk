import { metrics } from '@opentelemetry/api';

export function observeProcessMetrics(): () => void {
    const meter = metrics.getMeter('talosark.process');
    const memory = meter.createObservableGauge('process.memory.usage', { unit: 'By' });
    const cpu = meter.createObservableCounter('process.cpu.time', { unit: 's' });
    const memoryCallback: Parameters<typeof memory.addCallback>[0] = (result) => {
        const usage = process.memoryUsage();
        result.observe(usage.rss, { type: 'rss' });
        result.observe(usage.heapUsed, { type: 'heap_used' });
        result.observe(usage.heapTotal, { type: 'heap_total' });
        result.observe(usage.external, { type: 'external' });
    };
    const cpuCallback: Parameters<typeof cpu.addCallback>[0] = (result) => {
        const usage = process.cpuUsage();
        result.observe(usage.user / 1e6, { state: 'user' });
        result.observe(usage.system / 1e6, { state: 'system' });
    };
    memory.addCallback(memoryCallback);
    cpu.addCallback(cpuCallback);
    return () => {
        memory.removeCallback(memoryCallback);
        cpu.removeCallback(cpuCallback);
    };
}
