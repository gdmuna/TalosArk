import { z } from 'zod';
import { TaskError } from '../task.error.js';
import type { TaskValue } from '../task.types.js';

export const policySchema = z.strictObject({
    maxAttempts: z.number().int().min(1).max(20),
    timeoutMs: z.number().int().min(100).max(3_600_000),
    backoff: z.strictObject({
        type: z.enum(['fixed', 'exponential']),
        delay: z.number().int().min(100).max(60_000),
    }),
    repeatable: z.boolean(),
});

export function taskValue(value: unknown): TaskValue {
    let count = 0;
    const seen = new Set<object>();
    const visit = (item: unknown, depth: number): TaskValue => {
        if (++count > 4096 || depth > 12) throw new TaskError({ reason: 'invalid-input' });
        if (item === null || typeof item === 'boolean' || typeof item === 'string') return item;
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (!item || typeof item !== 'object' || seen.has(item))
            throw new TaskError({ reason: 'invalid-input' });
        seen.add(item);
        try {
            if (Array.isArray(item)) return item.map((entry) => visit(entry, depth + 1));
            if (Object.getPrototypeOf(item) !== Object.prototype)
                throw new TaskError({ reason: 'invalid-input' });
            return Object.fromEntries(
                Object.entries(item).map(([key, entry]) => [key, visit(entry, depth + 1)])
            );
        } finally {
            seen.delete(item);
        }
    };
    const result = visit(value, 0);
    if (Buffer.byteLength(JSON.stringify(result)) > 65_536)
        throw new TaskError({ reason: 'invalid-input' });
    return result;
}
