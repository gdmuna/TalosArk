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
export const IamError = defineErrorClass<typeof catalog, IamFailure>(catalog, {
    name: 'IamError',
    diagnosticMessage: (failure) =>
        ({
            'not-configured': 'Identity provider is not configured',
            configuration: 'Invalid identity provider configuration or authentication',
            unavailable: 'Identity provider is unavailable',
            'grant-rejected': 'Identity provider rejected the authorization grant',
            'invalid-response': 'Identity provider returned an invalid response',
            'request-failed': 'Identity provider request failed',
        })[failure.reason],
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type IamError = InstanceType<typeof IamError>;
