import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

const catalog = defineInternalErrorCatalog('resource', [
    'invalid-input',
    'invalid-provider',
    'not-ready',
    'missing-provider',
    'invalid-descriptor',
    'already-initialized',
]);

interface ResourceFailure {
    reason: keyof typeof catalog;
    kind?: string;
}

export const ResourceError = defineErrorClass<typeof catalog, ResourceFailure>(catalog, {
    name: 'ResourceError',
    diagnosticMessage: (failure) => {
        const message = {
            'invalid-input': 'Resource input violates the declared constraints',
            'invalid-provider': 'Resource provider violates the declared contract',
            'not-ready': 'Resource providers have not been initialized successfully',
            'missing-provider': 'A required resource provider is not registered',
            'invalid-descriptor': 'Resource provider returned an invalid descriptor',
            'already-initialized': 'Resource providers may only be initialized once',
        }[failure.reason];
        return failure.kind && /^[A-Z][A-Z0-9_]{0,63}$/.test(failure.kind)
            ? `${message} (${failure.kind})`
            : message;
    },
});
