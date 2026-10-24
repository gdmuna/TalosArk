import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/error.factory.js';

const catalog = defineInternalErrorCatalog('authorization-target', [
    'invalid-input',
    'invalid-provider',
    'invalid-facts',
    'missing-provider',
    'not-ready',
    'already-initialized',
]);

interface AuthorizationTargetFailure {
    reason: keyof typeof catalog;
    kind?: string;
}

export const AuthorizationTargetError = defineErrorClass<
    typeof catalog,
    AuthorizationTargetFailure
>(catalog, {
    name: 'AuthorizationTargetError',
    diagnosticMessage: (failure) => {
        const message = {
            'invalid-input': 'Authorization request violates the declared constraints',
            'invalid-provider': 'Authorization target provider violates the declared contract',
            'invalid-facts': 'Authorization target provider returned invalid scope facts',
            'missing-provider': 'A required authorization target provider is not registered',
            'not-ready': 'Authorization target providers have not been initialized successfully',
            'already-initialized': 'Authorization target providers may only be initialized once',
        }[failure.reason];
        return failure.kind && /^[a-z][a-z0-9-]{0,63}$/.test(failure.kind)
            ? `${message} (${failure.kind})`
            : message;
    },
});
