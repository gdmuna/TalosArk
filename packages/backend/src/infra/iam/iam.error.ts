import axios from 'axios';
import { HttpError } from '@/infra/http/http.error.js';

export type IamFailure = {
    reason:
        | 'not-configured'
        | 'configuration'
        | 'unavailable'
        | 'grant-rejected'
        | 'invalid-response'
        | 'request-failed';
    upstreamStatus?: number;
};

export class IamError extends Error {
    constructor(
        readonly failure: IamFailure,
        options?: ErrorOptions
    ) {
        super(`Identity provider operation failed: ${failure.reason}`, options);
        this.name = 'IamError';
    }
}

export function normalizeIamSdkError(error: unknown): IamError | undefined {
    if (error instanceof IamError) return error;
    if (!axios.isAxiosError(error)) return undefined;
    if (error.cause instanceof HttpError && !error.response) {
        const normalized = normalizeIamHttpError(error.cause);
        if (normalized) return new IamError(normalized.failure, { cause: error });
    }
    const status = error.response?.status;
    if (
        !error.response &&
        ![
            'ERR_NETWORK',
            'ECONNREFUSED',
            'ECONNRESET',
            'ETIMEDOUT',
            'ECONNABORTED',
            'ENOTFOUND',
            'EAI_AGAIN',
        ].includes(error.code ?? '')
    ) {
        return undefined;
    }
    const oauthError: unknown = error.response?.data?.error;
    const reason =
        !error.response || (status !== undefined && status >= 500) || status === 429
            ? 'unavailable'
            : oauthError === 'invalid_grant'
              ? 'grant-rejected'
              : oauthError === 'invalid_client' || oauthError === 'unauthorized_client'
                ? 'configuration'
                : 'request-failed';
    return new IamError({ reason, upstreamStatus: status }, { cause: error });
}

export function normalizeIamHttpError(error: unknown): IamError | undefined {
    if (!(error instanceof HttpError)) return undefined;
    const reason = error.failure.reason;
    if (['network', 'timeout', 'queue-full'].includes(reason))
        return new IamError({ reason: 'unavailable' }, { cause: error });
    if (reason === 'invalid-response')
        return new IamError(
            { reason: 'invalid-response', upstreamStatus: error.failure.upstreamStatus },
            { cause: error }
        );
    return undefined;
}
