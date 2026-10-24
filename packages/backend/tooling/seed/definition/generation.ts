import { createHash } from 'node:crypto';
import type { GenerationContext } from './dataset.js';

export function generationContext(seed: number, referenceDate: string): GenerationContext {
    return Object.freeze({
        referenceDate,
        integer(key: string, min: number, max: number) {
            if (
                !Number.isSafeInteger(min) ||
                !Number.isSafeInteger(max) ||
                max < min ||
                max - min >= 2 ** 32
            )
                throw new Error('Invalid generation integer range');
            const sample = createHash('sha256').update(`${seed}:${key}`).digest().readUInt32BE();
            return min + (sample % (max - min + 1));
        },
    });
}
