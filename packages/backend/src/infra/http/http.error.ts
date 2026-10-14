import type { HttpResponse } from './type.js';
import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

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

export type HttpFailure = {
    reason: HttpFailureReason;
    operation: string;
    upstreamStatus?: number;
    retryAfterMs?: number;
    /** Private adapter data, never included in observations or public details. */
    response?: HttpResponse;
};
const catalog = defineInternalErrorCatalog('outbound-http', [
    'network',
    'timeout',
    'cancelled',
    'http-status',
    'invalid-response',
    'queue-full',
    'authentication-required',
    'authentication-busy',
    'authentication-changed',
    'authentication-expired',
]);
export const HttpError = defineErrorClass<typeof catalog, HttpFailure>(catalog, {
    name: 'HttpError',
    diagnosticMessage: (failure) =>
        ({
            network: 'Outbound HTTP connection failed',
            timeout: 'Outbound HTTP request deadline exceeded',
            cancelled: 'Outbound HTTP request was cancelled',
            'http-status': 'Upstream HTTP server returned an unsuccessful status',
            'invalid-response': 'Upstream HTTP response is invalid',
            'queue-full': 'Outbound HTTP admission or send queue is full',
            'authentication-required': 'Outbound HTTP credentials are required',
            'authentication-busy': 'Outbound HTTP credential refresh admission is full',
            'authentication-changed': 'Outbound HTTP credentials changed during the request',
            'authentication-expired': 'Outbound HTTP credentials expired',
        })[failure.reason],
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type HttpError = InstanceType<typeof HttpError>;
