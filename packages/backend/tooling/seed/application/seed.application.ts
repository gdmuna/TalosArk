import { fileURLToPath } from 'node:url';
import type { PrismaEnvironmentSource } from '../../database/environment.js';
import { PreparedFixtures } from '../fixture/fixture.reader.js';
import { productSeedCatalog } from '../plan/product.catalog.js';
import { SeedPlanner, type SeedManifest } from '../plan/planner.js';
import type { SeedPlanRequest } from '../plan/request.js';
import type { SeedMode, SeedRunResult } from '../runtime/result.js';
export type { SeedRunResult } from '../runtime/result.js';

export interface SeedTargetRequest {
    readonly environment: PrismaEnvironmentSource;
    readonly expectedDatabase: string;
}
export type SeedStorageSource =
    | { readonly kind: 'json'; readonly path: string }
    | { readonly kind: 'profile'; readonly name: 'dev' | 'dev.local' | 'test' | 'test.local' };
export interface SeedArtifactRequest {
    readonly output?: string;
    readonly credentialsOutput?: string;
}
export interface SeedRunRequest {
    readonly plan: SeedPlanRequest;
    readonly mode: SeedMode;
    readonly expectedFingerprint?: string;
    readonly target: SeedTargetRequest;
    readonly storageSource?: SeedStorageSource;
    readonly artifacts: SeedArtifactRequest;
}

export class SeedApplication {
    private readonly planner = new SeedPlanner(productSeedCatalog);
    constructor(private readonly options: { readonly fixtureRoot?: string } = {}) {}

    list() {
        return productSeedCatalog.list();
    }

    async plan(request: SeedPlanRequest, signal?: AbortSignal): Promise<SeedManifest> {
        const draft = this.planner.build(request);
        const fixtures = await this.prepare(
            draft.steps.flatMap((step) => step.files),
            false,
            signal
        );
        try {
            return this.planner.seal(draft, fixtures.facts()).manifest;
        } finally {
            await fixtures.close();
        }
    }

    async run(request: SeedRunRequest, signal?: AbortSignal): Promise<SeedRunResult> {
        if (!['apply', 'verify', 'resume'].includes(request.mode))
            throw new Error('Unknown seed execution mode');
        const draft = this.planner.build(request.plan);
        const fixtures = await this.prepare(
            draft.steps.flatMap((step) => step.files),
            true,
            signal
        );
        let result: SeedRunResult | undefined;
        try {
            const program = this.planner.seal(draft, fixtures.facts());
            if (
                request.expectedFingerprint !== undefined &&
                request.expectedFingerprint !== program.manifest.fingerprint
            )
                throw new Error('Seed plan fingerprint changed; no database connection was opened');
            signal?.throwIfAborted();
            const { runSeed } = await import('../runtime/host.js');
            result = await runSeed(productSeedCatalog, program, fixtures, request, signal);
            return result;
        } finally {
            try {
                await fixtures.close();
            } catch {
                const diagnostic = {
                    stage: 'cleanup' as const,
                    code: 'seed.fixture-cleanup-failed',
                    message: 'Unable to remove private input snapshots',
                };
                if (result) result.diagnostics.push(diagnostic);
                else console.error(`[seed] ${diagnostic.message}`);
            }
        }
    }

    resume(request: Omit<SeedRunRequest, 'mode'>, signal?: AbortSignal): Promise<SeedRunResult> {
        return this.run({ ...request, mode: 'resume' }, signal);
    }

    async inspect(target: SeedTargetRequest, namespace: string) {
        const { inspectSeedTarget } = await import('../runtime/host.js');
        return inspectSeedTarget(target, namespace);
    }

    async exportReport(target: SeedTargetRequest, namespace: string, output: string) {
        const { exportSeedReport } = await import('../runtime/host.js');
        return exportSeedReport(target, namespace, output);
    }

    async initialize(target: SeedTargetRequest, purpose?: 'development' | 'test'): Promise<void> {
        const { initializeSeedTarget } = await import('../runtime/host.js');
        await initializeSeedTarget(target, purpose);
    }

    private prepare(
        refs: Parameters<typeof PreparedFixtures.prepare>[0],
        snapshot: boolean,
        signal?: AbortSignal
    ) {
        return PreparedFixtures.prepare(
            refs,
            this.options.fixtureRoot ?? fileURLToPath(new URL('../fixture/file/', import.meta.url)),
            snapshot,
            signal
        );
    }
}
