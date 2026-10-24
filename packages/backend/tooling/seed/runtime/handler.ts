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
            run: (data: unknown, input: unknown, execution: SeedExecution) => Promise<unknown>;
        }
    >();
    register<K extends SeederKind>(
        kind: K,
        implementation: BusinessSeeder<NoInfer<K>>,
        actor?: (input: z.output<NoInfer<K>['input']>) => string
    ): this {
        if (this.implementations.has(kind.id)) throw new Error(`Duplicate seeder ${kind.id}`);
        this.implementations.set(kind.id, {
            version: kind.version,
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
                return actor ? execution.asActor(actor(normalized), work) : work();
            },
        });
        return this;
    }
    require(steps: readonly SeedStep[]): void {
        for (const step of steps)
            if (this.implementations.get(step.seederId)?.version !== step.kindVersion)
                throw new Error(
                    `Missing or incompatible seeder ${step.seederId}@${step.kindVersion}`
                );
    }
    run(step: SeedStep, input: unknown, execution: SeedExecution): Promise<unknown> {
        const implementation = this.implementations.get(step.seederId);
        if (!implementation || implementation.version !== step.kindVersion)
            throw new Error(`Missing seeder ${step.seederId}`);
        return implementation.run(step.data, input, execution);
    }
}
