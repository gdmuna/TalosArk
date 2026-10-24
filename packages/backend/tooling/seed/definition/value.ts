import { createHash } from 'node:crypto';
import { z } from 'zod';

export const jsonSchema = z.json();
export type SeedJson = z.infer<typeof jsonSchema>;
export function seedJson(value: unknown): SeedJson {
    return jsonSchema.parse(
        JSON.parse(
            JSON.stringify(value, (_key, item: unknown) =>
                typeof item === 'bigint' ? item.toString() : item
            )
        )
    );
}

export function freezeJson<T>(value: T): T {
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value)) freezeJson(child);
        Object.freeze(value);
    }
    return value;
}

export function seedHash(value: unknown): string {
    const canonical = (item: SeedJson): string => {
        if (Array.isArray(item)) return `[${item.map(canonical).join(',')}]`;
        if (item !== null && typeof item === 'object')
            return `{${Object.keys(item)
                .sort()
                .map((key) => `${JSON.stringify(key)}:${canonical(item[key])}`)
                .join(',')}}`;
        return JSON.stringify(item);
    };
    return createHash('sha256')
        .update(canonical(seedJson(value)))
        .digest('hex');
}
