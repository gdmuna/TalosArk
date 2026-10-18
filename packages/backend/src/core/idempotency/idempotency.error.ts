import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

const catalog = defineInternalErrorCatalog('idempotency', [
    'invalid-input',
    'invalid-key',
    'invalid-scope',
    'invalid-fingerprint',
    'fingerprint-conflict',
    'request-in-progress',
    'lease-lost',
    'invalid-result',
    'result-unavailable',
    'invalid-repository',
]);

interface IdempotencyFailure {
    readonly reason: keyof typeof catalog;
}

export const IdempotencyError = defineErrorClass<typeof catalog, IdempotencyFailure>(catalog, {
    name: 'IdempotencyError',
    diagnosticMessage: (failure) =>
        ({
            'invalid-input': 'Idempotency input violates the declared constraints',
            'invalid-key': 'The idempotency key is invalid',
            'invalid-scope': 'The idempotency scope is invalid',
            'invalid-fingerprint': 'The idempotency fingerprint is invalid',
            'fingerprint-conflict': 'The idempotency key was reused with different input',
            'request-in-progress': 'The idempotent request is already in progress',
            'lease-lost': 'The idempotency lease is no longer valid',
            'invalid-result': 'The idempotency result is not serializable',
            'result-unavailable': 'The original idempotency result is no longer available',
            'invalid-repository': 'The idempotency repository violated its contract',
        })[failure.reason],
});
