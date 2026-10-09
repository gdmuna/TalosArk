import { defineErrorCatalog, RequestErrorContract } from '../protocol/error.js';

export const RequestErrorDefinition = defineErrorCatalog('request', {
    validation: {
        public: RequestErrorContract.validation,
        protocol: { http: { status: 400 } },
        internal: { logLevel: 'info' },
    },
    authentication: {
        public: RequestErrorContract.authentication,
        protocol: { http: { status: 401 } },
        internal: { logLevel: 'info' },
    },
    forbidden: {
        public: RequestErrorContract.forbidden,
        protocol: { http: { status: 403 } },
        internal: { logLevel: 'info' },
    },
    notFound: {
        public: RequestErrorContract.notFound,
        protocol: { http: { status: 404 } },
        internal: { logLevel: 'info' },
    },
    rateLimited: {
        public: RequestErrorContract.rateLimited,
        protocol: { http: { status: 429 } },
        internal: { logLevel: 'info' },
    },
    payloadTooLarge: {
        public: RequestErrorContract.payloadTooLarge,
        protocol: { http: { status: 413 } },
        internal: { logLevel: 'info' },
    },
    unsupportedContent: {
        public: RequestErrorContract.unsupportedContent,
        protocol: { http: { status: 415 } },
        internal: { logLevel: 'info' },
    },
    processingTimeout: {
        public: RequestErrorContract.processingTimeout,
        protocol: { http: { status: 504 } },
        internal: { logLevel: 'warn' },
    },
    notImplemented: {
        public: RequestErrorContract.notImplemented,
        protocol: { http: { status: 501 } },
        internal: { logLevel: 'error' },
    },
    invalid: {
        public: RequestErrorContract.invalid,
        protocol: { http: { status: 400 } },
        internal: { logLevel: 'info' },
    },
});
