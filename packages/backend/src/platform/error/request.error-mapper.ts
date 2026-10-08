import { RequestErrorContract } from '@talos-ark/contracts/protocol';
import { mapError, type ErrorDefinition, type ErrorMapper } from './error.definition.js';
import { RequestError } from './request.error.js';

export const RequestErrorDefinition = {
    validation: {
        contract: RequestErrorContract.validation,
        message: 'Request validation failed',
        logLevel: 'info',
    },
    authentication: {
        contract: RequestErrorContract.authentication,
        message: 'Authentication required',
        logLevel: 'info',
    },
    forbidden: {
        contract: RequestErrorContract.forbidden,
        message: 'Request forbidden',
        logLevel: 'info',
    },
    notFound: {
        contract: RequestErrorContract.notFound,
        message: 'Resource not found',
        logLevel: 'info',
    },
    rateLimited: {
        contract: RequestErrorContract.rateLimited,
        message: 'Too many requests',
        logLevel: 'info',
    },
    payloadTooLarge: {
        contract: RequestErrorContract.payloadTooLarge,
        message: 'Request payload too large',
        logLevel: 'info',
    },
    unsupportedContent: {
        contract: RequestErrorContract.unsupportedContent,
        message: 'Unsupported content type',
        logLevel: 'info',
    },
    processingTimeout: {
        contract: RequestErrorContract.processingTimeout,
        message: 'Request processing timed out',
        logLevel: 'warn',
    },
    notImplemented: {
        contract: RequestErrorContract.notImplemented,
        message: 'Operation not implemented',
        logLevel: 'error',
    },
    invalid: {
        contract: RequestErrorContract.invalid,
        message: 'Invalid request',
        logLevel: 'info',
    },
    internal: {
        contract: RequestErrorContract.internal,
        message: 'An internal error occurred',
        logLevel: 'error',
    },
} as const satisfies Record<string, ErrorDefinition>;

export const mapRequestError: ErrorMapper = (error) => {
    if (!(error instanceof RequestError)) return;
    const { failure } = error;
    if (failure.reason === 'validation') {
        return mapError(RequestErrorDefinition.validation, { issues: failure.issues });
    }
    return mapError(RequestErrorDefinition[failure.reason], null);
};
