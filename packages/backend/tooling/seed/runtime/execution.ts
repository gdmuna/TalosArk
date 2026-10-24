import { z } from 'zod';
import { ulid } from 'ulid';
import type { DatabaseRuntime } from '../../../src/infra/database/database.runtime.js';
import type { AlsContextAdapter } from '../../../src/platform/context/als-context.adapter.js';
import { seedHash } from '../definition/value.js';
import { SeedStore, type SeedRecordRow, type SeedSnapshot } from './store.js';
import {
    SeedMissingReceipt,
    seedErrorMessage,
    type SeedMode,
    type SeedVerification,
} from './result.js';

interface RecordOptions<S extends z.ZodType> {
    key: string;
    output: S;
    create(): Promise<NoInfer<z.output<S>>>;
    inspect(output: NoInfer<z.output<S>>): Promise<unknown>;
}
export interface SeedExternalContext<C> {
    readonly idempotencyKey: string;
    readonly checkpoint: C;
    saveCheckpoint(value: C): Promise<void>;
}

export class SeedExecution {
    readonly codePrefix: string;
    readonly verification: SeedVerification[] = [];
    private readonly seen = new Set<string>();
    private processed = 0;
    private activeKey?: string;
    private readonly savedByKey: Map<string, SeedRecordRow>;
    private readonly inspections: {
        key: string;
        saved?: SeedRecordRow;
        inspect(): Promise<string>;
    }[] = [];

    private constructor(
        private readonly database: DatabaseRuntime,
        private readonly context: AlsContextAdapter,
        private readonly store: SeedStore,
        readonly namespace: string,
        readonly step: string,
        readonly mode: SeedMode,
        private readonly saved: SeedRecordRow[],
        readonly signal: AbortSignal,
        private readonly attemptId?: string,
        private readonly beforeWrite: () => void = () => {},
        readonly recoveryCheck = false
    ) {
        this.codePrefix = `S${seedHash(namespace).slice(0, 10).toUpperCase()}-${step}`;
        this.savedByKey = new Map(saved.map((record) => [record.key, record]));
    }

    get recordCount(): number {
        return this.processed;
    }
    get currentKey(): string | undefined {
        return this.activeKey;
    }
    hasReceipt(key: string): boolean {
        return this.savedByKey.has(key);
    }
    credentialKey(key: string): string {
        return `${this.step}/${key}`;
    }

    static async open(
        database: DatabaseRuntime,
        context: AlsContextAdapter,
        store: SeedStore,
        namespace: string,
        step: string,
        mode: SeedMode,
        signal: AbortSignal,
        attemptId?: string,
        beforeWrite?: () => void,
        recoveryCheck = false
    ) {
        return new SeedExecution(
            database,
            context,
            store,
            namespace,
            step,
            mode,
            await store.records(namespace, step),
            signal,
            attemptId,
            beforeWrite,
            recoveryCheck
        );
    }

    async asActor<T>(userId: string, work: () => Promise<T>): Promise<T> {
        this.signal.throwIfAborted();
        const user = await this.database.queryClient.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });
        if (!user) throw new Error('Seed actor no longer exists');
        return this.context.run({ userId, requestId: ulid(), time: Date.now() }, work);
    }

    /** Only operations joining the ambient database transaction belong here. */
    record<S extends z.ZodType>(options: RecordOptions<S>): Promise<z.output<S>> {
        return this.perform(options, options.create);
    }

    /** The adapter owns reconciliation; the executor persists its stable intent/checkpoint. */
    external<S extends z.ZodType, C extends z.ZodType>(
        options: Omit<RecordOptions<S>, 'create'> & {
            checkpoint: C;
            create(context: SeedExternalContext<z.output<C>>): Promise<NoInfer<z.output<S>>>;
        }
    ): Promise<z.output<S>> {
        return this.perform(
            options,
            async () => {
                const operation = await this.writeTransaction(() =>
                    this.store.operation(this.namespace, this.step, options.key)
                );
                return options.create({
                    idempotencyKey: operation.idempotency_key,
                    checkpoint: z.parse<C>(options.checkpoint, operation.checkpoint),
                    saveCheckpoint: (value) =>
                        this.writeTransaction(() =>
                            this.store.checkpoint(
                                this.namespace,
                                this.step,
                                options.key,
                                z.parse<C>(options.checkpoint, value)
                            )
                        ),
                });
            },
            true
        );
    }

    private async perform<S extends z.ZodType>(
        options: Omit<RecordOptions<S>, 'create'>,
        create: () => Promise<z.output<S>>,
        external = false
    ): Promise<z.output<S>> {
        this.activeKey = options.key;
        this.signal.throwIfAborted();
        if (this.seen.has(options.key))
            throw new Error(`Duplicate record ${this.step}/${options.key}`);
        this.seen.add(options.key);
        const saved = this.savedByKey.get(options.key);
        if (!saved && this.mode === 'verify') {
            this.verification.push({ step: this.step, key: options.key, status: 'missing' });
            throw new SeedMissingReceipt(`Missing seed receipt: ${this.step}/${options.key}`);
        }
        let output: z.output<S>;
        if (saved) output = z.parse<S>(options.output, saved.output);
        else {
            this.beforeWrite();
            // Publication cannot join the receipt transaction. A successful return is
            // acknowledged even if cancellation arrived immediately after publication.
            const published = external
                ? { output: z.parse<S>(options.output, await create()) }
                : undefined;
            output = await this.writeTransaction(async () => {
                const value = published
                    ? published.output
                    : z.parse<S>(options.output, await create());
                const hash = seedHash(await options.inspect(value));
                if (!published) this.signal.throwIfAborted();
                await this.store.append(this.namespace, this.step, options.key, value, hash);
                return value;
            });
        }
        const actor = this.context.get()?.userId;
        this.inspections.push({
            key: options.key,
            saved,
            inspect: () => {
                const inspect = () =>
                    this.database.transaction.run(
                        async () => {
                            this.signal.throwIfAborted();
                            return seedHash(await options.inspect(output));
                        },
                        { isolationLevel: 'RepeatableRead' }
                    );
                return actor ? this.asActor(actor, inspect) : inspect();
            },
        });
        this.processed++;
        if (this.processed % 100 === 0)
            console.info(`[seed] ${this.step}: ${this.processed} receipt(s) loaded/committed`);
        return output;
    }

    private writeTransaction<T>(work: () => Promise<T>): Promise<T> {
        const attemptId = this.attemptId;
        if (!attemptId) throw new Error('Seed writes require an owned attempt');
        return this.database.transaction.run(
            async () => {
                await this.store.guard(this.namespace, attemptId);
                return work();
            },
            { isolationLevel: 'ReadCommitted', timeout: 15000 }
        );
    }

    async verifyFinalState(forResume = false): Promise<void> {
        for (const item of this.inspections) {
            this.signal.throwIfAborted();
            try {
                const hash = await item.inspect();
                const expected = item.saved?.final_snapshot_hash;
                if (expected || forResume) {
                    if (hash !== (expected ?? item.saved?.snapshot_hash))
                        throw new Error(
                            'Seed data changed or disappeared; automatic adoption is disabled'
                        );
                    this.verification.push({ step: this.step, key: item.key, status: 'verified' });
                } else
                    this.verification.push({
                        step: this.step,
                        key: item.key,
                        status: 'unsealed',
                        message: 'Receipt exists, but no sealed final snapshot is available',
                    });
            } catch (error) {
                this.signal.throwIfAborted();
                this.verification.push({
                    step: this.step,
                    key: item.key,
                    status: 'changed',
                    message: seedErrorMessage(error),
                });
            }
        }
    }

    async finalSnapshots(): Promise<SeedSnapshot[]> {
        const snapshots: SeedSnapshot[] = [];
        for (const item of this.inspections) {
            this.signal.throwIfAborted();
            snapshots.push({ step: this.step, key: item.key, hash: await item.inspect() });
        }
        return snapshots;
    }

    finish(): void {
        for (const record of this.saved.filter((record) => !this.seen.has(record.key))) {
            if (this.mode !== 'verify')
                throw new Error(`Persisted record is not declared: ${this.step}/${record.key}`);
            this.verification.push({
                step: this.step,
                key: record.key,
                status: 'blocked',
                message:
                    'This persisted receipt could not be reached through the current step inputs',
            });
        }
    }
}
