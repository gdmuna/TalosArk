import type { HttpResponse } from './type.js';

export type HttpFailureReason =
    | 'network'
    | 'timeout'
    | 'cancelled'
    | 'http-status'
    | 'invalid-response'
    | 'queue-full'
    | 'authentication-required'
    | 'authentication-busy'
    | 'authentication-changed'
    | 'authentication-expired';

export class HttpError extends Error {
    constructor(
        readonly failure: {
            reason: HttpFailureReason;
            operation: string;
            upstreamStatus?: number;
            retryAfterMs?: number;
        },
        options?: ErrorOptions,
        /** Available to the owning adapter, never included in HTTP observations. */
        readonly response?: HttpResponse
    ) {
        super(`Outbound HTTP operation failed: ${failure.reason}`, options);
        this.name = 'HttpError';
    }
}
