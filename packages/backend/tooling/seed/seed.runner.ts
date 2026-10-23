import { ulid } from 'ulid';
import type { DatabaseRuntime } from '../../src/infra/database/database.runtime.js';
import type { AlsContextAdapter } from '../../src/platform/context/als-context.adapter.js';
import { SeedExecution } from './seed.execution.js';
import { SeedResults, SeedServices, seedHash, seedJson, type SeedStep } from './seed.definition.js';
import { SeedStore } from './seed.store.js';

export interface SeedPlan {
    readonly entry: string;
    readonly version: number;
    readonly namespace: string;
    readonly actorUserId?: string;
    readonly target: { organizationId: string; workspaceId: string } | null;
    readonly seed: number;
    readonly referenceDate: string;
    readonly parameters: unknown;
    readonly steps: readonly SeedStep[];
}

export function describePlan(plan: SeedPlan) {
    return seedJson({
        ...plan,
        engineVersion: 2,
        steps: plan.steps.map(({ key, datasetId, version, tags, seederId, parameters, data }) => ({
            key,
            datasetId,
            version,
            tags,
            seederId,
            parameters,
            contentHash: seedHash(data),
        })),
    });
}

export class SeedRunner {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly context: AlsContextAdapter,
        private readonly services: SeedServices
    ) {}

    async run(plan: SeedPlan, mode: 'apply' | 'verify', signal: AbortSignal) {
        signal.throwIfAborted();
        if (new Set(plan.steps.map((step) => step.key)).size !== plan.steps.length)
            throw new Error('Group contains duplicate step keys');
        const store = new SeedStore(this.database);
        const description = describePlan(plan);
        const hash = seedHash(description);
        const previous = await store.run(plan.namespace);
        if (previous && previous.plan_hash !== hash)
            throw new Error(
                'Namespace already belongs to a different plan, version, actor or parameters; choose a new namespace'
            );
        if (mode === 'apply' && previous && previous.status !== 'completed')
            throw new Error(
                `Previous run is ${previous.status}. Inspect its receipts with verify; automatic replay is disabled. Choose a new namespace for a fresh run.`
            );
        if (mode === 'verify' && !previous) throw new Error('No run exists in this namespace');
        const verifying = mode === 'verify' || !!previous;
        if (previous?.status === 'completed') await store.requireFinalSnapshots(plan.namespace);
        const user = plan.actorUserId
            ? await this.database.queryClient.user.findUnique({
                  where: { id: plan.actorUserId },
                  select: { id: true },
              })
            : undefined;
        if (plan.actorUserId && !user)
            throw new Error('The explicitly selected local actor does not exist');
        if (!verifying) await store.start(plan.namespace, description, hash);
        const results = new SeedResults();
        let completed = 0;
        let active: SeedExecution | undefined;
        const executions: SeedExecution[] = [];
        const outputs: Record<string, unknown> = {};
        try {
            for (const step of plan.steps) {
                signal.throwIfAborted();
                console.info(
                    `[seed] ${verifying ? 'Verifying' : 'Applying'} ${step.key} (${step.datasetId}@${step.version})`
                );
                const execution = await SeedExecution.open(
                    this.database,
                    this.context,
                    store,
                    plan.namespace,
                    step.key,
                    verifying ? 'verify' : 'apply',
                    signal
                );
                active = execution;
                executions.push(execution);
                const value = await this.context.run(
                    { requestId: ulid(), userId: plan.actorUserId, time: Date.now() },
                    () => this.services.run(step, step.input(results), execution)
                );
                execution.finish();
                results.set(step, value);
                outputs[step.key] = value;
                completed++;
                console.info(
                    `[seed] ${step.key}: ${execution.recordCount} record(s) ${verifying ? 'loaded for final verification' : 'committed; final snapshots pending'}`
                );
            }
            for (const execution of executions) await execution.verifyFinalState();
            if (!verifying) await store.finish(plan.namespace, 'completed');
            console.info(
                `[seed] ${verifying ? 'Verified' : 'Completed'} ${completed} dataset(s). Namespace: ${plan.namespace}`
            );
            return {
                namespace: plan.namespace,
                planHash: hash,
                mode: verifying ? 'verify' : 'apply',
                outputs,
            };
        } catch (error) {
            if (!verifying)
                await store.finish(plan.namespace, 'failed').catch(() => {
                    console.error(
                        '[seed] Unable to mark the run as failed; inspect seed.run and its retained receipts.'
                    );
                });
            console.error(
                `[seed] Stopped after ${completed}/${plan.steps.length} dataset(s); ${active?.recordCount ?? 0} record(s) processed in ${active?.step ?? 'the current step'}. Committed receipts remain in seed.record for namespace ${plan.namespace}.`
            );
            throw error;
        }
    }
}
