import 'reflect-metadata';
import { mkdir, open, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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

async function artifact(path?: string, privateFile = false) {
    if (!path) return undefined;
    await mkdir(dirname(resolve(path)), { recursive: true });
    return open(path, 'wx', privateFile ? 0o600 : 0o644);
}

export async function initializeSeedTarget(
    request: SeedTargetRequest,
    purpose: 'development' | 'test'
): Promise<void> {
    if (!['development', 'test'].includes(purpose))
        throw new Error('Seed initialization requires development/test purpose');
    const selected = environment(request);
    const target = await SeedTarget.open(selected.values.DATABASE_URL, request.expectedDatabase);
    try {
        await target.initialize(purpose, fileURLToPath(new URL('./schema.sql', import.meta.url)));
    } finally {
        await target.close();
    }
}

export async function runSeed(
    catalog: SeedCatalog,
    program: SeedProgram,
    fixtures: PreparedFixtures,
    request: SeedRunRequest,
    signal?: AbortSignal
) {
    const selected = environment(request.target);
    const target = await SeedTarget.open(
        selected.values.DATABASE_URL,
        request.target.expectedDatabase
    );
    const cancellation = new AbortController();
    const stop = () =>
        cancellation.abort(
            new Error('Seed target connection was lost; committed receipts are retained')
        );
    const combined = signal ? AbortSignal.any([signal, cancellation.signal]) : cancellation.signal;
    target.client.on('error', stop);
    target.client.on('end', stop);
    let output: Awaited<ReturnType<typeof open>> | undefined;
    let credentials: Awaited<ReturnType<typeof open>> | undefined;
    try {
        combined.throwIfAborted();
        await target.preflight(program);
        const needsStorage = program.manifest.resources.includes('object-storage');
        if (needsStorage !== !!request.storageSource)
            throw new Error(
                'Select a storage source exactly when the plan requires object storage'
            );
        const storage = request.storageSource
            ? await storageConfiguration(request.storageSource)
            : undefined;
        if (
            request.mode === 'apply' &&
            program.steps.some((step) => step.seederId === 'account') &&
            !request.artifacts.credentialsOutput
        )
            throw new Error(
                'Account creation requires a private credentials output file; secrets are never printed'
            );
        // Reserve exclusive destinations before any business operation can commit.
        output = await artifact(request.artifacts.output);
        credentials =
            request.mode === 'apply'
                ? await artifact(request.artifacts.credentialsOutput, true)
                : undefined;
        const definitions = await Promise.all(
            catalog.contributions
                .filter((item) => program.manifest.capabilities.includes(item.definition.id))
                .map((item) => item.load())
        );
        const { SeedModule } = await import('../../../src/bootstrap/composition/seed.module.js');
        const app = await NestFactory.createApplicationContext(
            SeedModule.forRoot({
                databaseUrl: selected.values.DATABASE_URL,
                definitions,
                program,
                fixtures,
                storage,
            }),
            { logger: false, abortOnError: false }
        );
        const secrets = app.get(SeedSecrets);
        try {
            combined.throwIfAborted();
            const report = await app.get(SeedRunner).run(program, request.mode, combined);
            if (output) await output.writeFile(`${JSON.stringify(report, null, 2)}\n`);
            return report;
        } finally {
            try {
                if (credentials)
                    await credentials.writeFile(`${JSON.stringify(secrets.export(), null, 2)}\n`);
            } finally {
                secrets.clear();
                await app.close();
            }
        }
    } finally {
        try {
            await output?.close();
        } finally {
            try {
                await credentials?.close();
            } finally {
                try {
                    await target.close();
                } finally {
                    target.client.off('error', stop);
                    target.client.off('end', stop);
                }
            }
        }
    }
}
