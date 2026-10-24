import { z } from 'zod';
import type { FixtureFileRef } from '../fixture/fixture.definition.js';

export interface SeederKind {
    readonly id: string;
    readonly version: number;
    readonly data: z.ZodType;
    readonly input: z.ZodType;
    readonly output: z.ZodType;
}
export interface GenerationContext {
    readonly referenceDate: string;
    integer(key: string, min: number, max: number): number;
}
export interface DatasetDefinition<P extends z.ZodType, D> {
    readonly id: string;
    readonly version: number;
    readonly tags: readonly string[];
    readonly description: string;
    readonly parameters: P;
    build(parameters: z.output<P>, context: GenerationContext): D;
    files?(data: D): readonly FixtureFileRef[];
}
export interface BoundDataset<K extends SeederKind, P extends z.ZodType> {
    readonly definition: DatasetDefinition<P, z.input<K['data']>>;
    readonly kind: K;
}
export function defineDatasetFor<const K extends SeederKind>(kind: K) {
    return <P extends z.ZodType>(
        definition: DatasetDefinition<P, z.input<K['data']>>
    ): BoundDataset<K, P> => Object.freeze({ definition, kind });
}
