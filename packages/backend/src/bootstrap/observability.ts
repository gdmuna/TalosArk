import { readTelemetryConfig } from '@/config/telemetry.config.js';
import type { ObservabilityRuntime } from '@/platform/observability/observability.runtime.js';

/** The callback must dynamically import its application graph after SDK registration. */
export async function runWithObservability(
    role: 'api' | 'worker',
    run: (runtime: ObservabilityRuntime | undefined) => Promise<unknown>
): Promise<void> {
    const config = readTelemetryConfig();
    const runtime = config.disabled
        ? undefined
        : (await import('@/platform/observability/observability.runtime.js')).startObservability(
              config,
              role
          );
    const { observeLifecycle } =
        await import('@/platform/observability/metrics/lifecycle.metric.js');
    try {
        await observeLifecycle('startup', () => run(runtime));
    } catch (error) {
        try {
            await runtime?.shutdown();
        } catch {
            process.stderr.write('Telemetry cleanup failed during application startup\n');
        }
        throw error;
    }
}
