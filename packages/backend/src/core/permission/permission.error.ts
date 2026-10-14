import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/error.factory.js';

const catalog = defineInternalErrorCatalog('permission', [
    'invalid-definition',
    'missing-definition',
    'scope-conflict',
    'not-ready',
    'already-initialized',
]);

interface PermissionFailure {
    reason: keyof typeof catalog;
    code?: string;
}

export const PermissionError = defineErrorClass<typeof catalog, PermissionFailure>(catalog, {
    name: 'PermissionError',
    diagnosticMessage: (failure) => {
        const message = {
            'invalid-definition': 'Authorization definition violates the declared constraints',
            'missing-definition': 'A required authorization definition is not registered',
            'scope-conflict': 'A required authorization definition has an incompatible scope',
            'not-ready': 'Authorization definitions have not been initialized successfully',
            'already-initialized': 'Authorization definitions may only be initialized once',
        }[failure.reason];
        const code =
            failure.code && /^[a-z][a-z0-9.-]{0,119}$/.test(failure.code)
                ? failure.code
                : undefined;
        return code ? `${message} (${code})` : message;
    },
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type PermissionError = InstanceType<typeof PermissionError>;
