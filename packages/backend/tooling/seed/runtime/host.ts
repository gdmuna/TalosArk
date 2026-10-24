import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { INestApplicationContext } from '@nestjs/common';
import { fileURLToPath } from 'node:url';
import { config } from '@dotenvx/dotenvx-ops';
import { NestFactory } from '@nestjs/core';
import { findBackendRoot } from '../../../scripts/backend-root.js';
import { loadPrismaEnvironment, redactDatabaseUrl } from '../../../scripts/prisma-environment.js';
import type {
    SeedRunRequest,
    SeedStorageSource,
    SeedTargetRequest,
} from '../application/seed.application.js';
import type { PreparedFixtures } from '../fixture/fixture.reader.js';
import type { SeedCatalog } from '../plan/catalog.js';
import type { SeedProgram } from '../plan/planner.js';
import { SeedTarget } from './target.js';
import { SeedRunner } from './runner.js';
import { SeedSecrets } from './secret.js';
import { reserveSeedReport, writeSeedReport } from './artifact.js';
import { seedErrorMessage, type SeedRunResult } from './result.js';

function environment(request: SeedTargetRequest) {
    if (process.env.NODE_ENV === 'production')
        throw new Error('Seeding is disabled under NODE_ENV=production');
    if (!request.expectedDatabase?.trim())
        throw new Error('An explicit database name confirmation is required');
    const selected = loadPrismaEnvironment(request.environment);
    if (
        /(?:^|[./_-])prod(?:uction)?(?:[./_-]|$)/i.test(selected.filePath.replaceAll('\\', '/')) ||
        (selected.source.kind === 'profile' && /^prod/i.test(selected.source.name))
    )
        throw new Error('Production environment files cannot be used for seeding');
    console.info(`[seed] Target: ${redactDatabaseUrl(selected.values.DATABASE_URL)}`);
    return selected;
}

async function storageConfiguration(source: SeedStorageSource) {
    const { StorageConfigValidateSchema } = await import('../../../src/config/storage.config.js');
    let values: unknown;
    if (source.kind === 'json') values = JSON.parse(await readFile(source.path, 'utf8'));
    else {
        if (!['dev', 'dev.local', 'test', 'test.local'].includes(source.name))
            throw new Error('Only development/test runtime storage profiles are allowed');
        const profile = source.name.startsWith('dev') ? 'development' : 'test';
        const root = resolve(findBackendRoot(), 'secrets/env');
        const files = source.name.endsWith('.local')
            ? [resolve(root, `.env.${profile}.local`), resolve(root, `.env.${profile}`)]
            : [resolve(root, `.env.${profile}`)];
        const isolated: Record<string, string> = {};
        const loaded = config({ path: files, processEnv: isolated, quiet: true, strict: true });
        if (loaded.error)
            throw new Error('Unable to load the explicitly selected runtime storage profile');
        values = isolated;
    }
    const result = StorageConfigValidateSchema.safeParse(values);
    if (!result.success)
        throw new Error(
            `Invalid storage configuration fields: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`
        );
    return result.data;
}

async function withSeedTarget<T>(
    request: SeedTargetRequest,
    work: (target: SeedTarget) => Promise<T>
): Promise<T> {
    const selected = environment(request);
    const target = await SeedTarget.open(selected.values.DATABASE_URL, request.expectedDatabase);
    let connectionError: Error | undefined;
    const onError = (error: Error) => {
        connectionError = error;
    };
    target.client.on('error', onError);
    const release = async () => {
        try {
            await target.close();
        } finally {
            target.client.off('error', onError);
        }
    };
    let result: T;
    try {
        result = await work(target);
        if (connectionError) throw connectionError;
    } catch (error) {
        await release().catch(() => console.error('[seed] Target cleanup also failed'));
        throw error;
    }
    await release();
    return result;
}

export async function initializeSeedTarget(
    request: SeedTargetRequest,
    purpose: 'development' | 'test'
): Promise<void> {
    if (!['development', 'test'].includes(purpose))
        throw new Error('Seed initialization requires development/test purpose');
    await withSeedTarget(request, (target) =>
        target.initialize(purpose, fileURLToPath(new URL('./schema.sql', import.meta.url)))
    );
}

export async function inspectSeedTarget(request: SeedTargetRequest, namespace: string) {
    if (!namespace?.trim()) throw new Error('A seed namespace is required');
    return withSeedTarget(request, (target) => target.inspect(namespace));
}

export async function exportSeedReport(
    request: SeedTargetRequest,
    namespace: string,
    output: string
) {
    const { run } = await inspectSeedTarget(request, namespace);
    if (!run.report)
        throw new Error(
            'No saved report exists; use verify with the original plan to inspect this run'
        );
    const file = await reserveSeedReport(output);
    const result = { ...run.report, delivery: 'completed' as const };
    try {
        await writeSeedReport(file, result);
    } catch (error) {
        await file.close().catch(() => console.error('[seed] Report cleanup also failed'));
        throw error;
    }
    await file.close();
    return result;
}

export async function runSeed(
    catalog: SeedCatalog,
    program: SeedProgram,
    fixtures: PreparedFixtures,
    request: SeedRunRequest,
    signal?: AbortSignal
): Promise<SeedRunResult> {
    const selected = environment(request.target);
    const target = await SeedTarget.open(
        selected.values.DATABASE_URL,
        request.target.expectedDatabase
    );
    const cancellation = new AbortController();
    const stop = () => {
        const error = new Error(
            'Seed target connection was lost; inspect retained receipts before retrying'
        );
        error.name = 'SeedControlLostError';
        cancellation.abort(error);
    };
    const combined = signal ? AbortSignal.any([signal, cancellation.signal]) : cancellation.signal;
    target.client.on('error', stop);
    target.client.on('end', stop);
    let output: Awaited<ReturnType<typeof reserveSeedReport>> | undefined;
    let app: INestApplicationContext | undefined;
    const secrets = new SeedSecrets();
    let credentialsOpened = false;
    let credentialsRequested = false;
    let report: SeedRunResult = {
        namespace: program.manifest.request.namespace,
        planHash: program.manifest.fingerprint,
        mode: request.mode,
        execution: 'failed',
        delivery: 'not-requested',
        outputs: {},
        exposed: {},
        verification: [],
        diagnostics: [],
    };
    const cleanup = async (name: string, close: () => Promise<void>) => {
        try {
            await close();
        } catch (error) {
            report.diagnostics.push({
                stage: 'cleanup',
                code: `seed.${name}-cleanup-failed`,
                message: seedErrorMessage(error),
            });
        }
    };
    try {
        combined.throwIfAborted();
        await target.preflight(program);
        const {
            rows: [previous],
        } = await target.client.query<{ status: string }>(
            'SELECT status FROM seed.run WHERE namespace = $1',
            [report.namespace]
        );
        const mode = previous?.status === 'completed' ? 'verify' : request.mode;
        report.mode = mode;
        const needsStorage = program.manifest.resources.includes('object-storage');
        if (needsStorage !== !!request.storageSource)
            throw new Error(
                'Select a storage source exactly when the plan requires object storage'
            );
        const storage = request.storageSource
            ? await storageConfiguration(request.storageSource)
            : undefined;
        const needsCredentials =
            mode !== 'verify' &&
            program.steps.some((step) => ['account', 'credential', 'team'].includes(step.seederId));
        if (needsCredentials && !request.artifacts.credentialsOutput)
            throw new Error(
                'Account/invitation writes require an explicit plaintext credentials file; secrets are never printed'
            );
        if (
            request.artifacts.output &&
            request.artifacts.credentialsOutput &&
            resolve(request.artifacts.output).toLowerCase() ===
                resolve(request.artifacts.credentialsOutput).toLowerCase()
        )
            throw new Error('Ordinary report and credentials must use different files');
        if (request.artifacts.output) output = await reserveSeedReport(request.artifacts.output);
        if (mode !== 'verify' && request.artifacts.credentialsOutput) {
            credentialsRequested = true;
            secrets.open(
                request.artifacts.credentialsOutput,
                { namespace: report.namespace, planHash: report.planHash },
                mode === 'resume'
            );
            credentialsOpened = true;
        }
        const definitions = await Promise.all(
            catalog.contributions
                .filter((item) => program.manifest.capabilities.includes(item.definition.id))
                .map((item) => item.load())
        );
        const { SeedModule } = await import('../../../src/bootstrap/composition/seed.module.js');
        app = await NestFactory.createApplicationContext(
            SeedModule.forRoot({
                databaseUrl: selected.values.DATABASE_URL,
                definitions,
                program,
                fixtures,
                storage,
                secrets,
            }),
            { logger: false, abortOnError: false }
        );
        combined.throwIfAborted();
        report = await app.get(SeedRunner).run(program, mode, combined);
    } catch (error) {
        report.execution = cancellation.signal.aborted
            ? 'uncertain'
            : signal?.aborted
              ? 'cancelled'
              : 'failed';
        report.diagnostics.push({
            stage: 'execution',
            code: 'seed.setup-or-execution-failed',
            message: seedErrorMessage(error),
        });
    } finally {
        const application = app;
        if (application) await cleanup('application', () => application.close());
        await cleanup('fixture', () => fixtures.close());
        if (secrets.error)
            report.diagnostics.push({
                stage: 'delivery',
                code: 'seed.credentials-save-failed',
                message: secrets.error.message,
            });
        const credentialsFailed = !!secrets.error || (credentialsRequested && !credentialsOpened);
        report.delivery = credentialsFailed
            ? 'failed'
            : output || credentialsOpened
              ? 'completed'
              : 'not-requested';
        secrets.clear();
        let written = false;
        if (output) {
            try {
                await writeSeedReport(output, report);
                written = true;
            } catch (error) {
                report.delivery = 'failed';
                report.diagnostics.push({
                    stage: 'delivery',
                    code: 'seed.report-export-failed',
                    message: seedErrorMessage(error),
                });
            }
        }
        if (report.attemptId && report.mode !== 'verify') {
            try {
                await target.saveReport(report);
            } catch (error) {
                report.delivery = 'failed';
                report.diagnostics.push({
                    stage: 'delivery',
                    code: 'seed.report-save-failed',
                    message: seedErrorMessage(error),
                });
            }
        }
        const beforeClose = report.diagnostics.length;
        target.client.off('end', stop);
        await cleanup('target', () => target.close());
        target.client.off('error', stop);
        if (
            output &&
            written &&
            (report.diagnostics.length !== beforeClose || report.delivery === 'failed')
        ) {
            try {
                await writeSeedReport(output, report);
            } catch (error) {
                report.delivery = 'failed';
                report.diagnostics.push({
                    stage: 'delivery',
                    code: 'seed.report-update-failed',
                    message: seedErrorMessage(error),
                });
            }
        }
        const reportFile = output;
        if (reportFile) await cleanup('report', () => reportFile.close());
    }
    return report;
}
