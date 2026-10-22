import { diag, DiagLogLevel, metrics } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
    BatchSpanProcessor,
    ParentBasedSampler,
    TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import type { TelemetryConfig } from '@/config/telemetry.config.js';
import { ulid } from 'ulid';
import { metricAttributeFilter, privateSpanProcessor } from './internal/telemetry.privacy.js';
import { observeProcessMetrics } from './metrics/process.metric.js';
import { observeRuntimeMetrics } from './metrics/runtime.metric.js';

export interface ObservabilityRuntime {
    readonly tracing: boolean;
    shutdown(timeoutMs?: number): Promise<void>;
}

/** One process owner, created before dynamically importing the application graph. */
export function startObservability(
    config: TelemetryConfig,
    role: 'api' | 'worker'
): ObservabilityRuntime {
    if (config.disabled) return { tracing: false, shutdown: async () => {} };
    let lastDiagnostic = -Infinity;
    let diagnostics = 0;
    const report = () => {
        diagnostics++;
        if (performance.now() - lastDiagnostic >= 30000) {
            lastDiagnostic = performance.now();
            // Never print exporter errors: they may contain endpoint credentials or response bodies.
            process.stderr.write(
                'Telemetry export or SDK operation failed; application continues\n'
            );
        }
    };
    const sdk = new NodeSDK({
        autoDetectResources: false,
        resource: resourceFromAttributes({
            'service.name': config.serviceName,
            'service.version': config.serviceVersion,
            'service.instance.id': ulid(),
            'deployment.environment.name': config.environment,
            'service.role': role,
        }),
        textMapPropagator: new W3CTraceContextPropagator(),
        logRecordProcessors: [],
        sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(config.sampleRate) }),
        spanLimits: {
            attributeCountLimit: 32,
            attributeValueLengthLimit: 160,
            eventCountLimit: 8,
            linkCountLimit: 8,
        },
        spanProcessors: config.traces
            ? [
                  privateSpanProcessor(
                      new BatchSpanProcessor({
                          exporter: new OTLPTraceExporter({
                              url: `${config.endpoint.replace(/\/$/, '')}/v1/traces`,
                              headers: config.headers,
                              timeoutMillis: config.timeoutMs,
                          }),
                          maxQueueSize: config.queueSize,
                          maxExportBatchSize: config.batchSize,
                          scheduledDelayMillis: 5000,
                          exportTimeoutMillis: config.timeoutMs,
                      })
                  ),
              ]
            : [],
        metricReaders: config.metrics
            ? [
                  new PeriodicExportingMetricReader({
                      exporter: new OTLPMetricExporter({
                          url: `${config.endpoint.replace(/\/$/, '')}/v1/metrics`,
                          headers: config.headers,
                          timeoutMillis: config.timeoutMs,
                          concurrencyLimit: 1,
                      }),
                      exportIntervalMillis: config.intervalMs,
                      exportTimeoutMillis: config.timeoutMs,
                  }),
              ]
            : [],
        views: [
            {
                instrumentName: '*',
                attributesProcessors: [metricAttributeFilter()],
                aggregationCardinalityLimit: 1000,
            },
        ],
        instrumentations: config.traces
            ? [new PrismaInstrumentation({ ignoreSpanTypes: ['prisma:client:serialize'] })]
            : [],
    });
    // NodeSDK may install its own diagnostic logger in its constructor.
    diag.setLogger(
        { error: report, warn: report, info() {}, debug() {}, verbose() {} },
        DiagLogLevel.WARN
    );
    try {
        sdk.start();
    } catch (error) {
        void sdk.shutdown().catch(report);
        throw error;
    }
    const stopProcessMetrics = config.metrics ? observeProcessMetrics() : () => {};
    const stopRuntimeMetrics = config.metrics ? observeRuntimeMetrics() : () => {};
    const diagnosticMetric = metrics
        .getMeter('talosark.telemetry')
        .createObservableCounter('telemetry.sdk.diagnostics');
    diagnosticMetric.addCallback((result) => result.observe(diagnostics));
    let closing: Promise<void> | undefined;
    return {
        tracing: config.traces,
        shutdown(timeoutMs = 1000) {
            return (closing ??= (async () => {
                let timer: NodeJS.Timeout | undefined;
                try {
                    await Promise.race([
                        sdk.shutdown(),
                        new Promise<never>((_, reject) => {
                            timer = setTimeout(
                                () => reject(new Error('Telemetry shutdown timed out')),
                                timeoutMs
                            );
                        }),
                    ]);
                } finally {
                    clearTimeout(timer);
                    stopProcessMetrics();
                    stopRuntimeMetrics();
                }
            })());
        },
    };
}
