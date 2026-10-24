import { ulid } from 'ulid';
import type { DatabaseRuntime } from '../../../src/infra/database/database.runtime.js';
import type { AlsContextAdapter } from '../../../src/platform/context/als-context.adapter.js';
import { SeedExecution } from './execution.js';
import { SeedResults, SeedServices } from './handler.js';
import { SeedStore } from './store.js';
import type { SeedProgram } from '../plan/planner.js';

export class SeedRunner {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly context: AlsContextAdapter,
        private readonly services: SeedServices
    ) {}

    async run(program: SeedProgram, mode: 'apply' | 'verify', signal: AbortSignal) {
        const { manifest, steps } = program;
        const namespace = manifest.request.namespace;
        const actorUserId =
            manifest.request.scope.kind === 'provision' ? undefined : manifest.request.scope.userId;
        signal.throwIfAborted();
        if (new Set(steps.map((step) => step.key)).size !== steps.length)
            throw new Error('Group contains duplicate step keys');
        const store = new SeedStore(this.database);
        const hash = manifest.fingerprint;
        const previous = await store.run(namespace);
        if (previous && previous.format_version !== 3)
            throw new Error(
                'This namespace uses an older seed plan format; use a new namespace. Existing data is retained.'
            );
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
        if (previous?.status === 'completed') await store.requireFinalSnapshots(namespace);
        const user = actorUserId
            ? await this.database.queryClient.user.findUnique({
                  where: { id: actorUserId },
                  select: { id: true },
              })
            : undefined;
        if (actorUserId && !user)
            throw new Error('The explicitly selected local actor does not exist');
        if (!verifying) await store.start(namespace, manifest, hash);
        const results = new SeedResults();
        let completed = 0;
        let active: SeedExecution | undefined;
        const executions: SeedExecution[] = [];
        const outputs: Record<string, unknown> = {};
        try {
            for (const step of steps) {
                signal.throwIfAborted();
                console.info(
                    `[seed] ${verifying ? 'Verifying' : 'Applying'} ${step.key} (${step.datasetId}@${step.version})`
                );
                const execution = await SeedExecution.open(
                    this.database,
                    this.context,
                    store,
                    namespace,
                    step.key,
                    verifying ? 'verify' : 'apply',
                    signal
                );
                active = execution;
                executions.push(execution);
                const value = await this.context.run(
                    { requestId: ulid(), userId: actorUserId, time: Date.now() },
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
            if (!verifying) await store.finish(namespace, 'completed');
            console.info(
                `[seed] ${verifying ? 'Verified' : 'Completed'} ${completed} dataset(s). Namespace: ${namespace}`
            );
            return {
                namespace,
                planHash: hash,
                mode: verifying ? 'verify' : 'apply',
                outputs,
                exposed: Object.fromEntries(
                    Object.entries(manifest.exposed).map(([name, key]) => [name, outputs[key]])
                ),
            };
        } catch (error) {
            if (!verifying)
                await store.finish(namespace, 'failed').catch(() => {
                    console.error(
                        '[seed] Unable to mark the run as failed; inspect seed.run and its retained receipts.'
                    );
                });
            console.error(
                `[seed] Stopped after ${completed}/${steps.length} dataset(s); ${active?.recordCount ?? 0} record(s) processed in ${active?.step ?? 'the current step'}. Committed receipts remain in seed.record for namespace ${namespace}.`
            );
            throw error;
        }
    }
}
