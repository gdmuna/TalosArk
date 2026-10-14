import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

export type KvsFailure = {
    reason: 'unavailable' | 'command-failed' | 'connect-timeout' | 'close-timeout';
};
const catalog = defineInternalErrorCatalog('kvs', [
    'unavailable',
    'command-failed',
    'connect-timeout',
    'close-timeout',
]);
export const KvsError = defineErrorClass<typeof catalog, KvsFailure>(catalog, {
    name: 'KvsError',
    diagnosticMessage: (failure) =>
        ({
            unavailable: 'KVS is unavailable',
            'command-failed': 'KVS command failed',
            'connect-timeout': 'KVS connection deadline exceeded',
            'close-timeout': 'KVS close deadline exceeded',
        })[failure.reason],
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type KvsError = InstanceType<typeof KvsError>;
