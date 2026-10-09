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
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type HttpError = InstanceType<typeof HttpError>;
