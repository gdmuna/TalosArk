import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

const catalog = defineInternalErrorCatalog('audit', [
    'invalid-input',
    'invalid-cursor',
    'scope-not-found',
    'actor-not-found',
    'resource-scope',
]);

export const AuditError = defineErrorClass(catalog, {
    name: 'AuditError',
    diagnosticMessage: (failure) =>
        ({
            'invalid-input': 'Audit input violates the declared constraints',
            'invalid-cursor': 'Audit cursor is invalid or belongs to a different query',
            'scope-not-found':
                'Audit organization or workspace was not found in the declared scope',
            'actor-not-found': 'Audit actor was not found',
            'resource-scope': 'Audit resources must exist in the event organization',
        })[failure.reason],
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type AuditError = InstanceType<typeof AuditError>;
