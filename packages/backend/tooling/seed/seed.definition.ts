import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SeedExecution } from './seed.execution.js';

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

export interface GenerationContext {
    readonly referenceDate: string;
    /** Stable per key; unrelated generation does not change an existing sample. */
    integer(key: string, min: number, max: number): number;
}

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

export interface DatasetDefinition<P extends z.ZodType, D> {
    readonly id: string;
    readonly version: number;
    readonly tags: readonly string[];
    readonly description: string;
    readonly parameters: P;
    build(parameters: z.output<P>, context: GenerationContext): D;
}

export interface SeederKind {
    readonly id: string;
    readonly data: z.ZodType;
    readonly input: z.ZodType;
    readonly output: z.ZodType;
}

export interface BusinessSeeder<K extends SeederKind> {
    seed(
        data: z.output<K['data']>,
        input: z.output<K['input']>,
        execution: SeedExecution
    ): Promise<z.output<K['output']>>;
}

export interface BoundDataset<K extends SeederKind, P extends z.ZodType> {
    readonly definition: DatasetDefinition<P, z.input<K['data']>>;
    readonly kind: K;
}

/** Pin the domain schemas before contextual typing of definitions and factories. */
export function defineDatasetFor<const K extends SeederKind>(kind: K) {
    return <P extends z.ZodType>(
        definition: DatasetDefinition<P, z.input<K['data']>>
    ): BoundDataset<K, P> => Object.freeze({ definition, kind });
}

export interface SeedStep<O = unknown> {
    readonly key: string;
    readonly datasetId: string;
    readonly version: number;
    readonly tags: readonly string[];
    readonly seederId: string;
    readonly parameters: SeedJson;
    readonly data: SeedJson;
    readonly output: (value: unknown) => O;
    input(results: SeedResults): unknown;
}

export class SeedResults {
    private readonly values = new Map<string, unknown>();

    get<O>(step: SeedStep<O>): O {
        if (!this.values.has(step.key))
            throw new Error(
                `Step ${step.key} has not completed; groups must declare dependencies first`
            );
        return step.output(this.values.get(step.key));
    }

    set(step: SeedStep, value: unknown): void {
        this.values.set(step.key, step.output(value));
    }
}

export function datasetStep<K extends SeederKind, P extends z.ZodType>(
    key: string,
    dataset: BoundDataset<K, P>,
    parameters: NoInfer<z.input<P>>,
    context: GenerationContext,
    input: (results: SeedResults) => NoInfer<z.input<K['input']>>
): SeedStep<z.output<K['output']>> {
    return datasetStepFromUnknown(key, dataset, parameters, context, input);
}

/** Only CLI/file boundaries may supply untyped parameters. */
export function datasetStepFromUnknown<K extends SeederKind, P extends z.ZodType>(
    key: string,
    dataset: BoundDataset<K, P>,
    parameters: unknown,
    context: GenerationContext,
    input: (results: SeedResults) => z.input<K['input']>
): SeedStep<z.output<K['output']>> {
    z.string()
        .regex(/^[a-z][a-z0-9-]{0,31}$/)
        .parse(key);
    const parsed = dataset.definition.parameters.parse(parameters);
    return Object.freeze({
        key,
        datasetId: dataset.definition.id,
        version: dataset.definition.version,
        tags: dataset.definition.tags,
        seederId: dataset.kind.id,
        parameters: seedJson(parsed),
        data: seedJson(dataset.kind.data.parse(dataset.definition.build(parsed, context))),
        output: (value: unknown) => z.parse<K['output']>(dataset.kind.output, value),
        input: (results: SeedResults) => dataset.kind.input.parse(input(results)),
    });
}

export class SeedServices {
    private readonly implementations = new Map<
        string,
        (data: unknown, input: unknown, execution: SeedExecution) => Promise<unknown>
    >();

    register<K extends SeederKind>(
        kind: K,
        implementation: BusinessSeeder<NoInfer<K>>,
        actor?: (input: z.output<K['input']>) => string
    ): this {
        if (this.implementations.has(kind.id)) throw new Error(`Duplicate seeder ${kind.id}`);
        this.implementations.set(kind.id, async (data, input, execution) => {
            const normalized = z.parse<K['input']>(kind.input, input);
            const work = async () =>
                z.parse<K['output']>(
                    kind.output,
                    await implementation.seed(
                        z.parse<K['data']>(kind.data, data),
                        normalized,
                        execution
                    )
                );
            return actor ? execution.asActor(actor(normalized), work) : work();
        });
        return this;
    }

    run(step: SeedStep, input: unknown, execution: SeedExecution): Promise<unknown> {
        const implementation = this.implementations.get(step.seederId);
        if (!implementation) throw new Error(`Missing seeder ${step.seederId}`);
        return implementation(step.data, input, execution);
    }
}
