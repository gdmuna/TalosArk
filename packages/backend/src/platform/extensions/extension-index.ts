import type { ExtensionEntry, ExtensionIndex, ExtensionSource } from './extension.contract.js';
import { ExtensionError } from './extension.error.js';

export function assertExtensionLabel(value: unknown): asserts value is string {
    if (
        typeof value !== 'string' ||
        !value.trim() ||
        value.length > 200 ||
        !value.isWellFormed() ||
        // eslint-disable-next-line no-control-regex -- Declaration labels must not inject terminal control bytes.
        /[\u0000-\u001f\u007f-\u009f]/.test(value)
    )
        throw new ExtensionError({ reason: 'invalid-entry' });
}

export function snapshotExtensionSource(source: ExtensionSource): ExtensionSource {
    if (!source || typeof source !== 'object')
        throw new ExtensionError({ reason: 'invalid-entry' });
    assertExtensionLabel(source.owner);
    if (source.kind === 'explicit')
        return Object.freeze({ kind: source.kind, owner: source.owner });
    if (source.kind !== 'provider' && source.kind !== 'method')
        throw new ExtensionError({ reason: 'invalid-entry' });
    assertExtensionLabel(source.provider);
    if (source.kind === 'provider')
        return Object.freeze({ kind: source.kind, owner: source.owner, provider: source.provider });
    assertExtensionLabel(source.method);
    return Object.freeze({
        kind: source.kind,
        owner: source.owner,
        provider: source.provider,
        method: source.method,
    });
}

export function createExtensionIndex<const E extends readonly ExtensionEntry[]>(
    input: E
): ExtensionIndex<E[number]> {
    if (!Array.isArray(input)) throw new ExtensionError({ reason: 'invalid-entry' });
    const values = new Map<string, ExtensionEntry>();
    const entries: ExtensionEntry[] = [];
    for (const entry of input) {
        if (!entry || typeof entry !== 'object' || !Object.hasOwn(entry, 'value'))
            throw new ExtensionError({ reason: 'invalid-entry' });
        assertExtensionLabel(entry.key);
        const source = snapshotExtensionSource(entry.source);
        const previous = values.get(entry.key);
        if (previous)
            throw new ExtensionError({
                reason: 'duplicate-key',
                key: entry.key,
                sources: [previous.source, source],
            });
        const snapshot = Object.freeze({ key: entry.key, value: entry.value, source });
        values.set(entry.key, snapshot);
        entries.push(snapshot);
    }
    const snapshot = Object.freeze(entries);
    // Only the value reference is retained; generic tuple correlation is a compile-time contract.
    return Object.freeze({
        require(key: string) {
            if (!values.has(key)) throw new ExtensionError({ reason: 'missing-key' });
            return values.get(key)?.value;
        },
        find: (key: string) => values.get(key)?.value,
        entries: () => snapshot,
    }) as ExtensionIndex<E[number]>;
}
