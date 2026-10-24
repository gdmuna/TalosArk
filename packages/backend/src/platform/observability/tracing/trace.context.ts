import { context, isSpanContextValid, propagation, ROOT_CONTEXT, trace } from '@opentelemetry/api';

export function currentTraceContext() {
    const span = trace.getSpanContext(context.active());
    return span && isSpanContextValid(span)
        ? { traceId: span.traceId, spanId: span.spanId, traceFlags: span.traceFlags }
        : {};
}

/** Only the configured W3C trace propagator writes headers; baggage is not enabled. */
export function injectTraceContext(headers: Record<string, string>): void {
    delete headers.traceparent;
    delete headers.tracestate;
    delete headers.baggage;
    propagation.inject(context.active(), headers);
}

/** Durable correlation only: never serialize baggage, request identity or an ALS store. */
export function captureTraceCarrier(): { traceParent?: string; traceState?: string } {
    const headers: Record<string, string> = {};
    injectTraceContext(headers);
    return {
        traceParent: headers.traceparent,
        traceState: headers.tracestate,
    };
}

export function sourceTraceLink(source: { traceParent: string | null; traceState: string | null }) {
    if (!source.traceParent || source.traceParent.length > 256) return undefined;
    const carrier = {
        traceparent: source.traceParent,
        ...(source.traceState && source.traceState.length <= 512
            ? { tracestate: source.traceState }
            : {}),
    };
    const span = trace.getSpanContext(propagation.extract(ROOT_CONTEXT, carrier));
    return span && isSpanContextValid(span) ? { context: span } : undefined;
}
