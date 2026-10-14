import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

const catalog = defineInternalErrorCatalog('context', [
    'missing',
    'actor-required',
    'actor-conflict',
]);

export const ContextError = defineErrorClass(catalog, {
    name: 'ContextError',
    diagnosticMessage: (failure) =>
        ({
            missing: 'An execution context is required to bind an authenticated user',
            'actor-required': 'An authenticated actor is required in the execution context',
            'actor-conflict':
                'An execution context cannot be rebound to a different authenticated user',
        })[failure.reason],
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type ContextError = InstanceType<typeof ContextError>;
