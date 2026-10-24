import { z } from 'zod';
import type { BoundDataset, GenerationContext, SeederKind } from './dataset.js';
import { freezeJson, seedJson, type SeedJson } from './value.js';
import { fixtureFileRefSchema, type FixtureFileRef } from '../fixture/fixture.definition.js';
import { SeedDefinitionError } from './diagnostic.js';
import type { SeedScopeSelection } from './scope.js';

declare const refValue: unique symbol;
export interface SeedRef<O> {
    readonly key: string;
    readonly [refValue]: O;
}
export type RefValues<R> = { [K in keyof R]: R[K] extends SeedRef<infer O> ? O : never };
export interface SeedOutputLookup {
    get<O>(ref: SeedRef<O>): O;
}
export interface SeedStep {
    readonly key: string;
    readonly datasetId: string;
    readonly version: number;
    readonly tags: readonly string[];
    readonly seederId: string;
    readonly kindVersion: number;
    readonly effect: 'mutation' | 'assertion';
    readonly parameters: SeedJson;
    readonly data: SeedJson;
    readonly from: Readonly<Record<string, string>>;
    readonly files: readonly FixtureFileRef[];
    output(value: unknown): unknown;
    input(results: SeedOutputLookup): unknown;
}
export interface GroupContext {
    readonly scope: SeedScopeSelection;
    readonly generation: GenerationContext;
}
export interface DatasetGroup<P extends z.ZodType> {
    readonly id: string;
    readonly version: number;
    readonly description: string;
    readonly purpose: 'demo' | 'regression' | 'volume' | 'integration';
    readonly parameters: P;
    readonly scopeModes: readonly SeedScopeSelection['kind'][];
    build(parameters: z.output<P>, builder: SeedGroupBuilder): void;
}
export function defineGroup<P extends z.ZodType>(definition: DatasetGroup<P>): DatasetGroup<P> {
    return Object.freeze(definition);
}

export class SeedGroupBuilder {
    private readonly declarations: SeedStep[] = [];
    private readonly references = new WeakSet<SeedRef<unknown>>();
    private readonly outputs: Record<string, string> = {};
    constructor(readonly context: GroupContext) {}

    step<K extends SeederKind, P extends z.ZodType, R extends Record<string, SeedRef<unknown>>>(
        key: string,
        dataset: BoundDataset<K, P>,
        parameters: NoInfer<z.input<P>>,
        binding: { from: R; bind(values: RefValues<NoInfer<R>>): NoInfer<z.input<K['input']>> }
    ): SeedRef<z.output<K['output']>> {
        return this.stepFromUnknown(key, dataset, parameters, binding);
    }

    /** Dynamic catalog selection only; authored groups use step's checked parameters. */
    stepFromUnknown<
        K extends SeederKind,
        P extends z.ZodType,
        R extends Record<string, SeedRef<unknown>>,
    >(
        key: string,
        dataset: BoundDataset<K, P>,
        parameters: unknown,
        binding: { from: R; bind(values: RefValues<NoInfer<R>>): NoInfer<z.input<K['input']>> }
    ): SeedRef<z.output<K['output']>> {
        z.string()
            .regex(/^[a-z][a-z0-9-]{0,31}$/)
            .parse(key);
        if (this.declarations.some((step) => step.key === key))
            throw new Error(`Duplicate seed step: ${key}`);
        const refs = Object.entries(binding.from);
        for (const [alias, ref] of refs)
            if (!this.references.has(ref))
                throw new Error(`Unknown or foreign reference ${alias} for ${key}`);
        let parsed: z.output<P>;
        let data: SeedJson;
        let files: readonly FixtureFileRef[];
        try {
            parsed = z.parse<P>(dataset.definition.parameters, parameters);
            const authored = dataset.definition.build(parsed, this.context.generation);
            data = freezeJson(seedJson(dataset.kind.data.parse(authored)));
            files = freezeJson(
                (dataset.definition.files?.(authored) ?? []).map((ref) =>
                    fixtureFileRefSchema.parse(ref)
                )
            );
        } catch (cause) {
            throw new SeedDefinitionError(dataset.definition.id, key, cause);
        }
        const bind = binding.bind;
        const from = Object.freeze(
            Object.fromEntries(refs.map(([alias, ref]) => [alias, ref.key]))
        );
        this.declarations.push(
            Object.freeze({
                key,
                datasetId: dataset.definition.id,
                version: dataset.definition.version,
                tags: Object.freeze([...dataset.definition.tags]),
                seederId: dataset.kind.id,
                kindVersion: dataset.kind.version,
                effect: dataset.kind.effect ?? 'mutation',
                parameters: freezeJson(seedJson(parsed)),
                data,
                from,
                files,
                output: (value: unknown) => z.parse<K['output']>(dataset.kind.output, value),
                input: (results: SeedOutputLookup) => {
                    const values = Object.fromEntries(
                        refs.map(([alias, ref]) => [alias, results.get(ref)])
                    ) as RefValues<R>;
                    return dataset.kind.input.parse(bind(values));
                },
            })
        );
        // Only this builder creates refs; the phantom type is not persisted.
        const ref = Object.freeze({ key }) as SeedRef<z.output<K['output']>>;
        this.references.add(ref);
        return ref;
    }
    expose(outputs: Readonly<Record<string, SeedRef<unknown>>>): void {
        for (const [name, ref] of Object.entries(outputs)) {
            if (
                !this.references.has(ref) ||
                (Object.hasOwn(this.outputs, name) && this.outputs[name] !== ref.key)
            )
                throw new Error(`Invalid exposed seed reference: ${name}`);
            this.outputs[name] = ref.key;
        }
    }
    finish() {
        return {
            steps: Object.freeze([...this.declarations]),
            exposed: Object.freeze({ ...this.outputs }),
        };
    }
}
