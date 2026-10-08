import type { ApiErrorResponse } from '@talos-ark/contracts/protocol';

export type HttpErrorKind = 'network' | 'timeout' | 'http' | 'api' | 'protocol';

export class HttpError extends Error {
    constructor(
        message: string,
        readonly kind: HttpErrorKind,
        readonly status?: number,
        readonly response?: ApiErrorResponse,
        readonly retryAfterMs?: number,
        cause?: unknown
    ) {
        super(message, { cause });
        this.name = 'HttpError';
    }

    get code() {
        return this.response?.code;
    }
    get requestId() {
        return this.response?.context?.requestId;
    }
    get details() {
        return this.response?.details;
    }
}

export class AuthenticationError extends Error {
    constructor(
        readonly reason: 'required' | 'busy' | 'expired' | 'changed' | 'unavailable',
        cause?: unknown
    ) {
        super(`Authentication ${reason}`, { cause });
        this.name = 'AuthenticationError';
    }
}
