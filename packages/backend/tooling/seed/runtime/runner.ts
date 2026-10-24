import { ulid } from 'ulid';
import type { DatabaseRuntime } from '../../../src/infra/database/database.runtime.js';
import type { AlsContextAdapter } from '../../../src/platform/context/als-context.adapter.js';
import { SeedExecution } from './execution.js';
import { SeedResults, SeedServices } from './handler.js';
import { SeedStore, type SeedSnapshot } from './store.js';
import { SeedSecrets } from './secret.js';
import type { SeedProgram } from '../plan/planner.js';
import {
    SeedMissingReceipt,
    seedErrorMessage,
    type SeedMode,
    type SeedRunResult,
} from './result.js';

export class SeedRunner {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly context: AlsContextAdapter,
        private readonly services: SeedServices,
        private readonly secrets: SeedSecrets
    ) {}

    async run(program: SeedProgram, mode: SeedMode, signal: AbortSignal): Promise<SeedRunResult> {
        const { manifest, steps } = program;
        const namespace = manifest.request.namespace;
        signal.throwIfAborted();
        if (new Set(steps.map((step) => step.key)).size !== steps.length)
            throw new Error('Group contains duplicate step keys');
        const store = new SeedStore(this.database);
        const previous = await store.run(namespace);
        if (previous && previous.format_version !== 3)
            throw new Error(
                'This namespace uses an older seed plan format; existing data is retained'
            );
        if (previous && previous.plan_hash !== manifest.fingerprint)
            throw new Error('Namespace belongs to a different plan, version, actor or parameters');
        if (mode === 'apply' && previous && previous.status !== 'completed')
            throw new Error(
                `Previous run is ${previous.status}; inspect it with verify/status, then explicitly select resume if supported`
            );
        if (mode !== 'apply' && !previous) throw new Error('No run exists in this namespace');
        if (previous?.status === 'completed') mode = 'verify';
        if (mode === 'resume') {
            if (previous?.execution_version !== 2)
                throw new Error(
                    'This run predates recoverable receipts; it can be inspected but not resumed'
                );
            this.services.requireRecovery(steps);
        }
        const selectedActor =
            manifest.request.scope.kind === 'provision' ? undefined : manifest.request.scope.userId;
        if (
            selectedActor &&
            !(await this.database.queryClient.user.findUnique({
                where: { id: selectedActor },
                select: { id: true },
            }))
        )
            throw new Error('The explicitly selected local actor does not exist');
        const attemptId = ulid();
        const result: SeedRunResult = {
            namespace,
            planHash: manifest.fingerprint,
            mode,
            attemptId: mode === 'verify' ? (previous?.attempt_id ?? undefined) : attemptId,
            execution: 'failed',
            delivery: 'not-requested',
            outputs: {},
            exposed: {},
            verification: [],
            diagnostics: [],
        };
        let ownsAttempt = false;
        let active: SeedExecution | undefined;
        let activeAssertion = false;
        const snapshots: SeedSnapshot[] = [];
        try {
            if (mode === 'verify') {
                await this.verify(program, store, signal, result);
                result.execution =
                    result.verification.some(
                        (item) => item.status === 'changed' || item.status === 'failed'
                    ) || result.diagnostics.length
                        ? 'failed'
                        : result.verification.some((item) => item.status !== 'verified')
                          ? 'partial'
                          : 'completed';
                return result;
            }
            ownsAttempt = true;
            if (mode === 'resume') {
                // Replacing the attempt waits for any old managed record transaction's row lock.
                await store.resume(namespace, attemptId);
                await this.verify(program, store, signal, result, true);
                const [{ count }] = await this.database.queryClient.$queryRawUnsafe<
                    { count: bigint }[]
                >('SELECT count(*) AS count FROM seed.record WHERE namespace = $1', namespace);
                if (
                    result.diagnostics.length ||
                    result.verification.some(
                        (item) => item.status === 'changed' || item.status === 'failed'
                    ) ||
                    BigInt(
                        result.verification.filter(
                            (item) => item.type !== 'assertion' && item.status === 'verified'
                        ).length
                    ) !== count
                )
                    throw new Error(
                        'Resume cannot confirm all committed receipts; no business operation was replayed'
                    );
                result.outputs = {};
            } else await store.start(namespace, manifest, manifest.fingerprint, attemptId);
            const actor =
                manifest.request.scope.kind === 'provision'
                    ? undefined
                    : manifest.request.scope.userId;
            const values = new SeedResults();
            const executions: SeedExecution[] = [];
            for (const step of steps) {
                signal.throwIfAborted();
                console.info(`[seed] ${mode === 'resume' ? 'Resuming' : 'Applying'} ${step.key}`);
                const execution = await SeedExecution.open(
                    this.database,
                    this.context,
                    store,
                    namespace,
                    step.key,
                    mode,
                    signal,
                    result.attemptId,
                    () => this.secrets.assertHealthy()
                );
                active = execution;
                activeAssertion = step.effect === 'assertion';
                executions.push(execution);
                try {
                    const output = await this.context.run(
                        { requestId: ulid(), userId: actor, time: Date.now() },
                        () => this.services.run(step, step.input(values), execution)
                    );
                    execution.finish();
                    values.set(step, output);
                    result.outputs[step.key] = output;
                } finally {
                    result.verification.push(...execution.verification);
                }
            }
            activeAssertion = false;
            for (const execution of executions)
                snapshots.push(...(await execution.finalSnapshots()));
            signal.throwIfAborted();
            // Publishing all final baselines and the completed state is one short transaction.
            await store.complete(namespace, attemptId, snapshots);
            result.execution = 'completed';
            result.verification.push(
                ...snapshots.map(({ step, key }) => ({
                    step,
                    key,
                    status: 'verified' as const,
                }))
            );
        } catch (error) {
            result.execution = signal.aborted
                ? signal.reason instanceof Error && signal.reason.name === 'SeedControlLostError'
                    ? 'uncertain'
                    : 'cancelled'
                : 'failed';
            result.diagnostics.push({
                stage: activeAssertion ? 'verification' : 'execution',
                code: activeAssertion ? 'seed.assertion-failed' : 'seed.execution-stopped',
                step: active?.step,
                key: active?.currentKey,
                message: seedErrorMessage(error),
            });
            if (ownsAttempt) {
                try {
                    const current = await store.run(namespace);
                    if (
                        current &&
                        current.attempt_id === result.attemptId &&
                        current.status === 'completed'
                    ) {
                        result.execution = 'completed';
                        result.verification = [
                            ...result.verification.filter((item) => item.type === 'assertion'),
                            ...snapshots.map(({ step, key }) => ({
                                step,
                                key,
                                status: 'verified' as const,
                            })),
                        ];
                        result.diagnostics.push({
                            stage: 'execution',
                            code: 'seed.commit-confirmed',
                            message:
                                'The completed state was confirmed after a lost acknowledgement',
                        });
                    } else if (current?.attempt_id === result.attemptId)
                        await store.finish(namespace, attemptId, result.execution);
                    else
                        throw new Error('Unable to confirm ownership of the stopped seed attempt', {
                            cause: error,
                        });
                } catch (outcomeError) {
                    result.execution = 'uncertain';
                    result.diagnostics.push({
                        stage: 'execution',
                        code: 'seed.outcome-unconfirmed',
                        message: seedErrorMessage(outcomeError),
                    });
                }
            }
        } finally {
            result.exposed = Object.fromEntries(
                Object.entries(manifest.exposed)
                    .filter(([, key]) => Object.hasOwn(result.outputs, key))
                    .map(([name, key]) => [name, result.outputs[key]])
            );
        }
        return result;
    }

    private async verify(
        program: SeedProgram,
        store: SeedStore,
        signal: AbortSignal,
        result: SeedRunResult,
        forResume = false
    ): Promise<void> {
        const values = new SeedResults();
        const actor =
            program.manifest.request.scope.kind === 'provision'
                ? undefined
                : program.manifest.request.scope.userId;
        for (const step of program.steps) {
            signal.throwIfAborted();
            // Final expectations may not hold yet during recovery. Run them after replay instead.
            if (forResume && step.effect === 'assertion') continue;
            if (Object.values(step.from).some((key) => !values.has(key))) {
                result.verification.push({
                    step: step.key,
                    ...(step.effect === 'assertion' ? { type: 'assertion' as const } : {}),
                    status: 'blocked',
                    message: 'An upstream step has no complete output',
                });
                const records = await store.records(result.namespace, step.key);
                for (const record of records)
                    result.verification.push({
                        step: step.key,
                        key: record.key,
                        status: 'blocked',
                        message: 'Receipt retained, but its inspection inputs could not be rebuilt',
                    });
                continue;
            }
            const execution = await SeedExecution.open(
                this.database,
                this.context,
                store,
                result.namespace,
                step.key,
                'verify',
                signal,
                undefined,
                undefined,
                forResume
            );
            try {
                console.info(`[seed] Checking ${step.key}`);
                const output = await this.context.run(
                    { requestId: ulid(), userId: actor, time: Date.now() },
                    () => this.services.run(step, step.input(values), execution)
                );
                values.set(step, output);
                result.outputs[step.key] = output;
            } catch (error) {
                signal.throwIfAborted();
                if (!(error instanceof SeedMissingReceipt)) {
                    result.diagnostics.push({
                        stage: 'verification',
                        code: 'seed.verification-failed',
                        step: step.key,
                        message: seedErrorMessage(error),
                    });
                    if (!execution.verification.some((item) => item.type === 'assertion'))
                        result.verification.push({
                            step: step.key,
                            ...(step.effect === 'assertion' ? { type: 'assertion' as const } : {}),
                            status: 'blocked',
                            message: seedErrorMessage(error),
                        });
                }
            } finally {
                execution.finish();
                try {
                    await execution.verifyFinalState(forResume);
                } finally {
                    result.verification.push(...execution.verification);
                }
            }
        }
    }
}
