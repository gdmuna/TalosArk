import { errorMonitor } from 'node:events';
import type { Readable } from 'node:stream';
import type { S3Client } from '@aws-sdk/client-s3';
import { metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';
import { withSpan } from '@/platform/observability/tracing/trace.span.js';
import { StorageError, type StorageOperation } from './storage.error.js';

const meter = metrics.getMeter('talosark.storage');
const operations = meter.createCounter('storage.operations');
const duration = meter.createHistogram('storage.operation.duration', {
    unit: 's',
    advice: durationAdvice,
});
const active = meter.createUpDownCounter('storage.active');
const requests = meter.createCounter('storage.client.requests');
const requestDuration = meter.createHistogram('storage.client.request.duration', {
    unit: 's',
    advice: durationAdvice,
});
const retries = meter.createCounter('storage.client.retries');
const streams = meter.createCounter('storage.streams');
const streamDuration = meter.createHistogram('storage.stream.duration', {
    unit: 's',
    advice: {
        explicitBucketBoundaries: [...durationAdvice.explicitBucketBoundaries, 60, 300, 1800, 3600],
    },
});
const activeStreams = meter.createUpDownCounter('storage.stream.active');
const bytes = meter.createCounter('storage.stream.read.bytes', { unit: 'By' });
const commands = new Set([
    'PutObjectCommand',
    'GetObjectCommand',
    'HeadObjectCommand',
    'CopyObjectCommand',
    'DeleteObjectCommand',
    'DeleteObjectsCommand',
    'CreateMultipartUploadCommand',
    'UploadPartCommand',
    'CompleteMultipartUploadCommand',
    'AbortMultipartUploadCommand',
    'ListPartsCommand',
]);

function metadata(value: unknown): { attempts?: number; httpStatusCode?: number } {
    if (typeof value !== 'object' || value === null || !('$metadata' in value)) return {};
    const data = value.$metadata;
    return typeof data === 'object' && data !== null ? data : {};
}

/** Deserialize runs per actual SDK attempt; presigning short-circuits before this step. */
export function observeStorageClient(client: S3Client): void {
    client.middlewareStack.add(
        (next, context) => async (args) => {
            const operation =
                context.commandName && commands.has(context.commandName)
                    ? context.commandName
                    : 'OtherCommand';
            return withSpan(
                'storage.request',
                { operation },
                async () => {
                    const started = performance.now();
                    let outcome = 'error';
                    let status = 0;
                    try {
                        const result = await next(args);
                        const response = result.response as { statusCode?: number } | undefined;
                        status = response?.statusCode ?? 0;
                        outcome = status >= 400 ? 'http-error' : 'success';
                        return result;
                    } catch (error) {
                        status = metadata(error).httpStatusCode ?? 0;
                        throw error;
                    } finally {
                        const attributes = {
                            operation,
                            outcome,
                            'http.response.status_code': status,
                        };
                        requests.add(1, attributes);
                        requestDuration.record((performance.now() - started) / 1000, attributes);
                        trace.getActiveSpan()?.setAttributes(attributes);
                        if (outcome !== 'success')
                            trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
                    }
                },
                { kind: SpanKind.CLIENT }
            );
        },
        {
            name: 'talosarkStorageRequestObservation',
            step: 'deserialize',
            priority: 'high',
            override: true,
        }
    );
    client.middlewareStack.add(
        (next, context) => async (args) => {
            const operation =
                context.commandName && commands.has(context.commandName)
                    ? context.commandName
                    : 'OtherCommand';
            let attempts: number | undefined;
            try {
                const result = await next(args);
                attempts = metadata(result.output).attempts;
                return result;
            } catch (error) {
                attempts = metadata(error).attempts;
                throw error;
            } finally {
                if (attempts !== undefined && Number.isSafeInteger(attempts) && attempts > 1)
                    retries.add(attempts - 1, { operation });
            }
        },
        {
            name: 'talosarkStorageRetryObservation',
            step: 'initialize',
            priority: 'high',
            override: true,
        }
    );
}

export function observeStorageOperation<T>(
    operation: StorageOperation,
    work: () => Promise<T>
): Promise<T> {
    return withSpan(
        'storage.operation',
        { operation },
        async () => {
            const started = performance.now();
            let outcome = 'success';
            active.add(1, { operation });
            try {
                return await work();
            } catch (error) {
                outcome =
                    error instanceof StorageError
                        ? error.failure.reason
                        : error instanceof Error && error.name === 'AbortError'
                          ? 'cancelled'
                          : 'unexpected';
                throw error;
            } finally {
                const attributes = { operation, outcome };
                trace.getActiveSpan()?.setAttributes(attributes);
                active.add(-1, { operation });
                operations.add(1, attributes);
                duration.record((performance.now() - started) / 1000, attributes);
            }
        },
        { kind: operation === 'presign' ? SpanKind.INTERNAL : SpanKind.CLIENT }
    );
}

/** Monitoring must neither start flowing nor consume errors that belong to the caller. */
export function observeStorageDownload(stream: Readable): void {
    const started = performance.now();
    const span = trace
        .getTracer('talosark.storage')
        .startSpan('storage.download.stream', { kind: SpanKind.CLIENT });
    activeStreams.add(1);
    let finished = false;
    const end = (outcome: 'completed' | 'error' | 'cancelled') => {
        if (finished) return;
        finished = true;
        stream.off('end', onEnd).off('close', onClose).off(errorMonitor, onError);
        activeStreams.add(-1);
        streams.add(1, { outcome });
        streamDuration.record((performance.now() - started) / 1000, { outcome });
        span.setAttribute('outcome', outcome);
        if (outcome !== 'completed') span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
    };
    const onEnd = () => end('completed');
    const onClose = () => end(stream.readableEnded ? 'completed' : 'cancelled');
    const onError = (error: Error) => end(error.name === 'AbortError' ? 'cancelled' : 'error');
    stream.once('end', onEnd).once('close', onClose).once(errorMonitor, onError);
}

export function recordStorageRead(chunk: unknown): void {
    if (typeof chunk === 'string') bytes.add(Buffer.byteLength(chunk));
    else if (chunk instanceof Uint8Array) bytes.add(chunk.byteLength);
}
