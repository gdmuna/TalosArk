import { IdempotencyError } from '../idempotency.error.js';
import type { IdempotencyJsonValue } from '../idempotency.types.js';

const maxBytes = 262_144;
const maxDepth = 32;
const maxNodes = 10_000;

export function canonicalJson(input: unknown): string {
    const fragments: string[] = [];
    const ancestors = new Set<object>();
    let bytes = 0;
    let nodes = 0;

    const reject = (): never => {
        throw new IdempotencyError({ reason: 'invalid-input' });
    };
    const append = (fragment: string): void => {
        bytes += Buffer.byteLength(fragment, 'utf8');
        if (bytes > maxBytes) reject();
        fragments.push(fragment);
    };
    const write = (value: unknown, depth: number): void => {
        if (++nodes > maxNodes || depth > maxDepth) reject();
        if (value === null) return append('null');
        if (typeof value === 'string') {
            if (value.length > maxBytes) reject();
            return append(JSON.stringify(value));
        }
        if (typeof value === 'boolean') return append(value ? 'true' : 'false');
        if (typeof value === 'number') {
            if (
                !Number.isFinite(value) ||
                (Number.isInteger(value) && !Number.isSafeInteger(value))
            )
                reject();
            return append(JSON.stringify(value));
        }
        if (typeof value !== 'object' || ancestors.has(value)) return reject();

        const array = Array.isArray(value);
        const prototype = Object.getPrototypeOf(value);
        if (!array && prototype !== Object.prototype && prototype !== null) reject();
        const keys = Reflect.ownKeys(value);
        if (array) {
            if (value.length > maxNodes - nodes || keys.length !== value.length + 1) reject();
        } else if (keys.length > maxNodes - nodes) reject();

        ancestors.add(value);
        append(array ? '[' : '{');
        const names = array
            ? Array.from({ length: value.length }, (_, index) => String(index))
            : keys.sort((left, right) => {
                  if (typeof left !== 'string' || typeof right !== 'string') return reject();
                  return left < right ? -1 : left > right ? 1 : 0;
              });
        for (const [index, key] of names.entries()) {
            if (typeof key !== 'string') return reject();
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return reject();
            if (index) append(',');
            if (!array) {
                if (key.length > maxBytes) reject();
                append(JSON.stringify(key));
                append(':');
            }
            write(descriptor.value, depth + 1);
        }
        append(array ? ']' : '}');
        ancestors.delete(value);
    };

    write(input, 0);
    return fragments.join('');
}

export function resultSnapshot(input: unknown): IdempotencyJsonValue {
    let canonical: string;
    try {
        canonical = canonicalJson(input);
    } catch (error) {
        if (IdempotencyError.is(error, 'invalid-input'))
            throw new IdempotencyError({ reason: 'invalid-result' });
        throw error;
    }
    const snapshot = JSON.parse(canonical) as IdempotencyJsonValue;
    const freeze = (value: IdempotencyJsonValue): void => {
        if (value && typeof value === 'object') {
            for (const child of Object.values(value)) freeze(child);
            Object.freeze(value);
        }
    };
    freeze(snapshot);
    return snapshot;
}
