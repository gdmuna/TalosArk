import { tracingChannel } from 'node:diagnostics_channel';
import { metrics, SpanKind, SpanStatusCode, trace, type Span } from '@opentelemetry/api';
import type { TelemetryConfig } from '@/config/telemetry.config.js';
import { durationAdvice } from '@/platform/observability/metrics/metric.policy.js';
import type { RedisClient } from './redis.client.js';

const meter = metrics.getMeter('talosark.kvs');
const operations = meter.createCounter('kvs.client.operations');
const duration = meter.createHistogram('kvs.client.operation.duration', {
    unit: 's',
    advice: durationAdvice,
});
const connections = meter.createCounter('kvs.connection.events');
const ready = meter.createObservableGauge('kvs.connection.ready');
const tracer = trace.getTracer('talosark.kvs');

// Do not use raw sendCommand names, keys, Lua text, arguments or vendor errors as labels.
const commands = new Set(
    'GET SET DEL UNLINK EXISTS EXPIRE PEXPIRE TTL PTTL INCR INCRBY DECR DECRBY MGET MSET SETNX GETDEL GETEX HGET HSET HDEL HGETALL HMGET HEXISTS HINCRBY LPUSH RPUSH LPOP RPOP LRANGE LLEN SADD SREM SISMEMBER SMEMBERS SCARD ZADD ZREM ZRANGE ZCARD ZSCORE EVAL EVALSHA PING SCAN PUBLISH SUBSCRIBE UNSUBSCRIBE'.split(
        ' '
    )
);
interface CommandContext {
    clientId: string;
    command?: string;
    batchMode?: string;
    result?: unknown;
}

/** node-redis 6 diagnostics cover native, Lua and pipeline calls without patching the client. */
export function observeKvsClient(client: RedisClient, config: TelemetryConfig): () => void {
    if (config.disabled || (!config.metrics && !config.traces)) return () => {};
    const cleanups: (() => void)[] = [];
    // The node-redis 6 diagnostics contract identifies clients by this getter.
    const clientId = client._clientId;
    for (const [name, fixed] of [
        ['command', undefined],
        ['batch', 'MULTI'],
        ['connect', 'CONNECT'],
    ] as const) {
        const channel = tracingChannel<CommandContext>(`node-redis:${name}`);
        const pending = new WeakMap<
            CommandContext,
            { started: number; operation: string; span?: Span }
        >();
        const finish = (data: CommandContext, failed: boolean) => {
            const entry = pending.get(data);
            if (!entry) return;
            pending.delete(data);
            const attributes = {
                operation: entry.operation,
                outcome: failed ? 'error' : 'success',
            };
            if (config.metrics) {
                operations.add(1, attributes);
                duration.record((performance.now() - entry.started) / 1000, attributes);
            }
            entry.span?.setAttribute('outcome', attributes.outcome);
            if (failed) entry.span?.setStatus({ code: SpanStatusCode.ERROR });
            entry.span?.end();
        };
        const handlers = {
            start(data: CommandContext) {
                if (data.clientId !== clientId || (name === 'batch' && data.batchMode !== 'MULTI'))
                    return;
                const operation =
                    fixed ?? (data.command && commands.has(data.command) ? data.command : 'OTHER');
                pending.set(data, {
                    started: performance.now(),
                    operation,
                    span: config.traces
                        ? tracer.startSpan('kvs.operation', {
                              kind: SpanKind.CLIENT,
                              attributes: { 'db.system.name': 'redis', operation },
                          })
                        : undefined,
                });
            },
            asyncEnd: (data: CommandContext) =>
                finish(
                    data,
                    name === 'batch' &&
                        Array.isArray(data.result) &&
                        data.result.some((value) => value instanceof Error)
                ),
            error: (data: CommandContext) => finish(data, true),
        };
        channel.subscribe(handlers);
        cleanups.push(() => channel.unsubscribe(handlers));
    }
    const report = (operation: string) => {
        if (config.metrics) connections.add(1, { operation });
    };
    const onReady = () => report('ready');
    const onReconnect = () => report('reconnecting');
    const onError = () => report('error');
    const onEnd = () => report('closed');
    client
        .on('ready', onReady)
        .on('reconnecting', onReconnect)
        .on('error', onError)
        .on('end', onEnd);
    const callback: Parameters<typeof ready.addCallback>[0] = (result) =>
        result.observe(client.isReady ? 1 : 0);
    if (config.metrics) ready.addCallback(callback);
    return () => {
        for (const cleanup of cleanups) cleanup();
        client
            .off('ready', onReady)
            .off('reconnecting', onReconnect)
            .off('error', onError)
            .off('end', onEnd);
        ready.removeCallback(callback);
    };
}
