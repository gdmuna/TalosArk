import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

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
const catalog = defineInternalErrorCatalog('iam', [
    'not-configured',
    'configuration',
    'unavailable',
    'grant-rejected',
    'invalid-response',
    'request-failed',
]);
export const IamError = defineErrorClass<typeof catalog, IamFailure>(catalog, { name: 'IamError' });
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type IamError = InstanceType<typeof IamError>;
