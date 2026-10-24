import type { Attributes } from '@opentelemetry/api';
import { createAllowListAttributesProcessor } from '@opentelemetry/sdk-metrics';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace';

const keys = [
    'http.request.method',
    'http.response.status_code',
    'http.route',
    'db.system',
    'db.system.name',
    'db.operation',
    'db.operation.name',
    'db.collection.name',
    'model',
    'method',
    'upstream',
    'operation',
    'outcome',
    'state',
    'type',
    'error.type',
    'task.kind',
    'phase',
    'mail.acceptance',
];
const traceKeys = [...keys, 'task.attempt'];

/** Values come from owner-defined labels or framework route templates, never request payloads. */
function attributes(input: Attributes): Attributes {
    const result: Attributes = {};
    for (const key of traceKeys) {
        const value = input[key];
        if (typeof value === 'string') result[key] = value.slice(0, 160);
        else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    }
    return result;
}

/** Project before the batch queue: raw SQL, URLs and exceptions never enter its buffers. */
export function privateSpanProcessor(batch: SpanProcessor): SpanProcessor {
    return {
        onStart() {},
        onEnd(span: ReadableSpan) {
            const safe = attributes(span.attributes);
            const spanContext = span.spanContext();
            batch.onEnd({
                name:
                    span.instrumentationScope.name === '@fastify/otel'
                        ? `${safe['http.request.method'] ?? 'HTTP'} ${safe['http.route'] ?? 'unmatched'}`
                        : /^[A-Za-z0-9_.:-]{1,160}$/.test(span.name)
                          ? span.name
                          : 'application.operation',
                kind: span.kind,
                spanContext: () => spanContext,
                parentSpanContext: span.parentSpanContext,
                startTime: span.startTime,
                endTime: span.endTime,
                duration: span.duration,
                ended: span.ended,
                resource: span.resource,
                instrumentationScope: span.instrumentationScope,
                droppedAttributesCount: span.droppedAttributesCount,
                droppedEventsCount: span.droppedEventsCount + span.events.length,
                droppedLinksCount: span.droppedLinksCount,
                attributes: safe,
                status: { code: span.status.code },
                events: [],
                links: span.links.map((link) => ({ context: link.context })),
            });
        },
        forceFlush: () => batch.forceFlush(),
        shutdown: () => batch.shutdown(),
    };
}

export const metricAttributeFilter = () => createAllowListAttributesProcessor(keys);
