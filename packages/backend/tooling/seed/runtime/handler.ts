import { z } from 'zod';
import { type SeederKind } from '../definition/dataset.js';
import type { SeedRef, SeedStep, SeedOutputLookup } from '../definition/group.js';
import type { SeedExecution } from './execution.js';
export interface BusinessSeeder<K extends SeederKind> {
    seed(
        data: z.output<K['data']>,
        input: z.output<K['input']>,
        execution: SeedExecution
    ): Promise<z.output<K['output']>>;
}
export class SeedResults implements SeedOutputLookup {
    private readonly values = new Map<string, unknown>();
    has(key: string): boolean {
        return this.values.has(key);
    }
    get<O>(ref: SeedRef<O>): O {
        if (!this.values.has(ref.key)) throw new Error(`Step ${ref.key} has not completed`);
        return this.values.get(ref.key) as O;
    }
    set(step: SeedStep, value: unknown): void {
        this.values.set(step.key, step.output(value));
    }
}
export class SeedServices {
    private readonly implementations = new Map<
        string,
        {
            version: number;
            recoverable: boolean;
            effect: 'mutation' | 'assertion';
            run: (data: unknown, input: unknown, execution: SeedExecution) => Promise<unknown>;
        }
    >();
    register<K extends SeederKind>(
        kind: K,
        implementation: BusinessSeeder<NoInfer<K>>,
        actor?: (input: z.output<NoInfer<K>['input']>) => string,
        recoverable = false
    ): this {
        if (this.implementations.has(kind.id)) throw new Error(`Duplicate seeder ${kind.id}`);
        this.implementations.set(kind.id, {
            version: kind.version,
            recoverable,
            effect: kind.effect ?? 'mutation',
            run: async (data, input, execution) => {
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
                const run = () => (kind.effect === 'assertion' ? execution.assert(work) : work());
                return actor ? execution.asActor(actor(normalized), run) : run();
            },
        });
        return this;
    }
    require(steps: readonly SeedStep[]): void {
        for (const step of steps)
            if (
                this.implementations.get(step.seederId)?.version !== step.kindVersion ||
                this.implementations.get(step.seederId)?.effect !== step.effect
            )
                throw new Error(
                    `Missing or incompatible seeder ${step.seederId}@${step.kindVersion}`
                );
    }
    requireRecovery(steps: readonly SeedStep[]): void {
        const unsupported = steps.filter(
            (step) =>
                step.effect !== 'assertion' && !this.implementations.get(step.seederId)?.recoverable
        );
        if (unsupported.length)
            throw new Error(
                `Resume is not supported by: ${unsupported.map((step) => step.seederId).join(', ')}. Inspect the retained receipts; no business operation was replayed.`
            );
    }
    run(step: SeedStep, input: unknown, execution: SeedExecution): Promise<unknown> {
        const implementation = this.implementations.get(step.seederId);
        if (
            !implementation ||
            implementation.version !== step.kindVersion ||
            implementation.effect !== step.effect
        )
            throw new Error(`Missing seeder ${step.seederId}`);
        return implementation.run(step.data, input, execution);
    }
}
