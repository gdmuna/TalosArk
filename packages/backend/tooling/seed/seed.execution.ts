import { z } from 'zod';
import type { DatabaseRuntime } from '../../src/infra/database/database.runtime.js';
import { seedHash } from './seed.definition.js';
import { SeedStore } from './seed.store.js';
import type { AlsContextAdapter } from '../../src/platform/context/als-context.adapter.js';
import { ulid } from 'ulid';

export class SeedExecution {
    readonly codePrefix: string;
    private readonly seen = new Set<string>();
    private processed = 0;
    private readonly savedByKey;
    private readonly inspections: (() => Promise<void>)[] = [];
    private constructor(
        private readonly database: DatabaseRuntime,
        private readonly context: AlsContextAdapter,
        private readonly store: SeedStore,
        readonly namespace: string,
        readonly step: string,
        readonly mode: 'apply' | 'verify',
        private readonly saved: Awaited<ReturnType<SeedStore['records']>>,
        readonly signal: AbortSignal
    ) {
        this.codePrefix = `S${seedHash(namespace).slice(0, 10).toUpperCase()}-${step}`;
        this.savedByKey = new Map(saved.map((record) => [record.key, record]));
    }

    get recordCount(): number {
        return this.processed;
    }

    static async open(
        database: DatabaseRuntime,
        context: AlsContextAdapter,
        store: SeedStore,
        namespace: string,
        step: string,
        mode: 'apply' | 'verify',
        signal: AbortSignal
    ) {
        return new SeedExecution(
            database,
            context,
            store,
            namespace,
            step,
            mode,
            await store.records(namespace, step),
            signal
        );
    }

    async asActor<T>(userId: string, work: () => Promise<T>): Promise<T> {
        const user = await this.database.queryClient.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });
        if (!user) throw new Error('Seed actor no longer exists');
        return this.context.run({ userId, requestId: ulid(), time: Date.now() }, work);
    }

    /** Business changes and their receipt commit together, one bounded operation at a time. */
    async record<S extends z.ZodType>(options: {
        key: string;
        output: S;
        create(): Promise<NoInfer<z.output<S>>>;
        inspect(output: NoInfer<z.output<S>>): Promise<unknown>;
        /** External workflows own their short transactions; publication and this receipt are not atomic. */
        transaction?: 'business-managed';
    }): Promise<z.output<S>> {
        this.signal.throwIfAborted();
        if (this.seen.has(options.key))
            throw new Error(`Duplicate record ${this.step}/${options.key}`);
        this.seen.add(options.key);
        const stored = this.savedByKey.get(options.key);
        if (stored) {
            const output = z.parse<S>(options.output, stored.output);
            const actor = this.context.get()?.userId;
            this.inspections.push(() =>
                this.inspectAs(actor, () =>
                    this.database.transaction.run(
                        async () => {
                            const expected = stored.final_snapshot_hash ?? stored.snapshot_hash;
                            if (seedHash(await options.inspect(output)) !== expected)
                                throw new Error(
                                    `Seed data changed or disappeared: ${this.step}/${options.key}`
                                );
                        },
                        { isolationLevel: 'RepeatableRead' }
                    )
                )
            );
            this.processed++;
            return output;
        }
        if (this.mode === 'verify')
            throw new Error(`Missing seed receipt: ${this.step}/${options.key}`);
        const external =
            options.transaction === 'business-managed'
                ? { output: z.parse<S>(options.output, await options.create()) }
                : undefined;
        const output = await this.database.transaction.run(
            async () => {
                const output = external
                    ? external.output
                    : z.parse<S>(options.output, await options.create());
                const hash = seedHash(await options.inspect(output));
                this.signal.throwIfAborted();
                await this.store.append(this.namespace, this.step, options.key, output, hash);
                return output;
            },
            { isolationLevel: 'ReadCommitted', timeout: 15000 }
        );
        const actor = this.context.get()?.userId;
        this.inspections.push(() =>
            this.inspectAs(actor, () =>
                this.database.transaction.run(
                    async () => {
                        this.signal.throwIfAborted();
                        await this.store.finalize(
                            this.namespace,
                            this.step,
                            options.key,
                            seedHash(await options.inspect(output))
                        );
                    },
                    { isolationLevel: 'RepeatableRead' }
                )
            )
        );
        this.processed++;
        if (this.processed % 100 === 0)
            console.info(`[seed] ${this.step}: ${this.processed} record(s) committed`);
        return output;
    }

    private inspectAs(actor: string | undefined, work: () => Promise<void>): Promise<void> {
        return actor ? this.asActor(actor, work) : work();
    }

    async verifyFinalState(): Promise<void> {
        for (const inspect of this.inspections) await inspect();
    }

    finish(): void {
        if (this.saved.some((record) => !this.seen.has(record.key)))
            throw new Error(
                `Dataset ${this.step} no longer declares all persisted records; increase its version`
            );
    }
}
