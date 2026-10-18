import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

const catalog = defineInternalErrorCatalog('facility', ['invalid-cursor', 'invalid-input']);

interface FacilityFailure {
    reason: keyof typeof catalog;
}

export const FacilityError = defineErrorClass<typeof catalog, FacilityFailure>(catalog, {
    name: 'FacilityError',
    diagnosticMessage: (failure) =>
        ({
            'invalid-cursor': 'Storage topology cursor is invalid or no longer matches the query',
            'invalid-input': 'Storage topology input violates the declared constraints',
        })[failure.reason],
});
