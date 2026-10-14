import { defineErrorClass, defineInternalErrorCatalog } from '../error/error.factory.js';
import type { ExtensionSource } from './extension.contract.js';

const catalog = defineInternalErrorCatalog('extension', [
    'invalid-entry',
    'duplicate-key',
    'missing-key',
    'discovery-scope',
    'target-unavailable',
    'not-ready',
]);

interface ExtensionFailure {
    reason: keyof typeof catalog;
    point?: string;
    key?: string;
    sources?: readonly ExtensionSource[];
}

const label = (value: string) =>
    /^[A-Za-z0-9_.:-]{1,200}$/.test(value) ? value : '[redacted label]';
const sourceLabel = (source: ExtensionSource) =>
    [
        source.owner,
        'provider' in source ? source.provider : undefined,
        'method' in source ? source.method : undefined,
    ]
        .filter((part): part is string => part !== undefined)
        .map(label)
        .join('/');

export const ExtensionError = defineErrorClass<typeof catalog, ExtensionFailure>(catalog, {
    name: 'ExtensionError',
    diagnosticMessage: (failure) => {
        const message = {
            'invalid-entry': 'Extension declaration is invalid',
            'duplicate-key': 'Duplicate extension key',
            'missing-key': 'Requested extension key is not registered',
            'discovery-scope': 'Extension discovery requires a static singleton provider',
            'target-unavailable': 'Extension discovery target is unavailable or not callable',
            'not-ready': 'Extension discovery requires application initialization',
        }[failure.reason];
        const context = [
            failure.point,
            failure.reason === 'duplicate-key' ? failure.key : undefined,
        ]
            .filter((part): part is string => part !== undefined)
            .map(label);
        const sources = failure.sources?.map(sourceLabel);
        return `${message}${context.length ? ` (${context.join(': ')})` : ''}${sources?.length ? `; sources: ${sources.join(', ')}` : ''}`;
    },
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type ExtensionError = InstanceType<typeof ExtensionError>;
