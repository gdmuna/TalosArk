import { SpanStatusCode, trace, type Attributes, type SpanOptions } from '@opentelemetry/api';

const tracer = trace.getTracer('talosark.application');

/** Diagnostics stay in the existing safe logger serializer, not vendor exception events. */
export async function withSpan<T>(
    name: string,
    attributes: Attributes,
    work: () => PromiseLike<T>,
    options: SpanOptions = {}
): Promise<T> {
    return tracer.startActiveSpan(name, { ...options, attributes }, async (span) => {
        try {
            return await work();
        } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
        } finally {
            span.end();
        }
    });
}

/** Preserve synchronous verifier/primitive interfaces; do not turn boolean results into promises. */
export function withSpanSync<T>(name: string, attributes: Attributes, work: () => T): T {
    return tracer.startActiveSpan(name, { attributes }, (span) => {
        try {
            return work();
        } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
        } finally {
            span.end();
        }
    });
}
