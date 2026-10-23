import 'reflect-metadata';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Command, Option } from 'commander';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { createSeedPlan, seedDatasetCatalog, seedGroups } from './seed.catalog.js';
import { describePlan, SeedRunner } from './seed.runner.js';
import { SeedTarget } from './seed.target.js';
import {
    choosePrismaEnvironment,
    loadPrismaEnvironment,
    redactDatabaseUrl,
    type PrismaEnvironmentSource,
} from '../../scripts/prisma-environment.js';

const program = new Command('db:seed')
    .description(
        'Plan, apply and verify development/test datasets. Runtime secrets are not loaded.'
    )
    .argument('<action>', 'list | plan | init | apply | verify')
    .addOption(new Option('--env <profile>', 'Prisma environment profile').conflicts('envFile'))
    .option('--env-file <path>', 'Explicit Prisma-only environment file')
    .option('--database <name>', 'Confirm the actual connected database name')
    .addOption(
        new Option('--purpose <purpose>', 'Explicit opt-in purpose for init').choices([
            'development',
            'test',
        ])
    )
    .option('--namespace <name>', 'Stable, unique fixture namespace')
    .option('--actor <uuid>', 'Existing local account under whose authority writes run')
    .option('--organization <uuid>', 'Use an existing organization; requires --workspace')
    .option('--workspace <uuid>', 'Use an existing workspace; requires --organization')
    .option('--group <id>', 'Named dataset composition')
    .option('--dataset <id>', 'One independently usable dataset')
    .option('--tag <tag...>', 'Select independent datasets matching all tags; uses defaults')
    .option('--params <json>', 'Dataset or group parameters as a JSON object')
    .option('--params-file <path>', 'Read parameters from a JSON file')
    .option('--seed <integer>', 'Generation seed', '42')
    .option(
        '--reference-date <date>',
        'Fixed generation reference date, not the application clock',
        '2026-01-01'
    )
    .option('--output <path>', 'Write successful output references as JSON');
program.option(
    '--credentials-output <path>',
    'Exclusive private file for newly created passwords and invitation tokens'
);
program.option(
    '--storage-config <path>',
    'Opt-in storage-only JSON configuration for attachment integration'
);

try {
    await main();
} catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
        console.info('[seed] Selection canceled; nothing was executed.');
        process.exitCode = 130;
    } else {
        console.error(`[seed] ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    }
}

async function main(): Promise<void> {
    program.parse();
    const [action] = program.args;
    const options = program.opts<{
        env?: string;
        envFile?: string;
        database?: string;
        purpose?: 'development' | 'test';
        namespace?: string;
        actor?: string;
        organization?: string;
        workspace?: string;
        group?: string;
        dataset?: string;
        tag?: string[];
        params?: string;
        paramsFile?: string;
        seed: string;
        referenceDate: string;
        output?: string;
        credentialsOutput?: string;
        storageConfig?: string;
    }>();
    if (action === 'list') {
        console.info(
            JSON.stringify(
                {
                    groups: seedGroups.map(({ id, version, description }) => ({
                        id,
                        version,
                        description,
                    })),
                    datasets: seedDatasetCatalog,
                },
                null,
                2
            )
        );
        return;
    }
    if (!['plan', 'init', 'apply', 'verify'].includes(action))
        throw new Error(`Unknown action ${action}`);
    if (action !== 'init' && !options.namespace)
        throw new Error('plan/apply/verify require --namespace');
    if (options.params !== undefined && options.paramsFile)
        throw new Error('Choose --params or --params-file');
    if (!!options.organization !== !!options.workspace)
        throw new Error('--organization and --workspace must be supplied together');
    const parameters: unknown = options.paramsFile
        ? JSON.parse(await readFile(options.paramsFile, 'utf8'))
        : options.params !== undefined
          ? JSON.parse(options.params)
          : undefined;
    const plan =
        action === 'init'
            ? undefined
            : createSeedPlan({
                  group: options.group,
                  dataset: options.dataset,
                  tags: options.tag,
                  parameters,
                  namespace: options.namespace ?? '',
                  actorUserId: options.actor,
                  target:
                      options.organization && options.workspace
                          ? { organizationId: options.organization, workspaceId: options.workspace }
                          : undefined,
                  seed: Number(options.seed),
                  referenceDate: options.referenceDate,
              });
    if (action === 'plan') {
        if (!plan) throw new Error('Missing seed plan');
        console.info(JSON.stringify(describePlan(plan), null, 2));
        return;
    }
    if (
        action === 'apply' &&
        plan?.steps.some((step) => step.seederId === 'account') &&
        !options.credentialsOutput
    )
        throw new Error(
            'Account creation requires --credentials-output; passwords are never printed or included in reports'
        );
    const needsStorage = plan?.steps.some((step) => step.seederId === 'attachment') ?? false;
    if (needsStorage !== !!options.storageConfig)
        throw new Error(
            'Use --storage-config exactly when selecting an attachment integration plan'
        );
    let storage: import('../../src/config/storage.config.js').StorageConfig | undefined;
    if (options.storageConfig) {
        const { StorageConfigValidateSchema } = await import('../../src/config/storage.config.js');
        const result = StorageConfigValidateSchema.safeParse(
            JSON.parse(await readFile(options.storageConfig, 'utf8'))
        );
        if (!result.success)
            throw new Error(
                `Invalid storage-only configuration fields: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`
            );
        storage = result.data;
    }
    if (process.env.NODE_ENV === 'production')
        throw new Error('Seeding is disabled under NODE_ENV=production');
    if (!options.database)
        throw new Error('--database is required for commands that connect to a database');
    const source: PrismaEnvironmentSource | undefined = options.env
        ? { kind: 'profile', name: options.env }
        : options.envFile
          ? { kind: 'file', path: options.envFile }
          : undefined;
    const environment = loadPrismaEnvironment(await choosePrismaEnvironment(source));
    if (
        /(?:^|[./_-])prod(?:uction)?(?:[./_-]|$)/i.test(
            environment.filePath.replaceAll('\\', '/')
        ) ||
        (environment.source.kind === 'profile' && /^prod/i.test(environment.source.name))
    )
        throw new Error('Production environment files cannot be used for seeding');
    console.info(`[seed] Target: ${redactDatabaseUrl(environment.values.DATABASE_URL)}`);
    const target = await SeedTarget.open(environment.values.DATABASE_URL, options.database);
    const cancellation = new AbortController();
    const stop = () =>
        cancellation.abort(
            new Error('Seed execution interrupted; committed receipts are retained')
        );
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    target.client.on('error', stop);
    target.client.on('end', stop);
    try {
        if (action === 'init') {
            if (!options.purpose)
                throw new Error('init requires --purpose development or --purpose test');
            await target.initialize(
                options.purpose,
                fileURLToPath(new URL('../../../tooling/seed/seed.schema.sql', import.meta.url))
            );
            console.info(
                `[seed] Database opted into ${options.purpose} seeding; business tables were not changed.`
            );
            return;
        }
        if (!plan) throw new Error('Missing seed plan');
        await target.preflight(plan);
        // No listeners or mail/queue clients; object storage is an explicit opt-in.
        const { SeedModule } = await import('../../src/bootstrap/composition/seed.module.js');
        const app = await NestFactory.createApplicationContext(
            SeedModule.forRoot(environment.values.DATABASE_URL, storage),
            { logger: false, abortOnError: false }
        );
        const { SeedSecrets } = await import('./seed.secret.js');
        const secrets = app.get(SeedSecrets);
        let credentials: Awaited<ReturnType<typeof open>> | undefined;
        try {
            if (action === 'apply' && options.credentialsOutput) {
                await mkdir(dirname(options.credentialsOutput), { recursive: true });
                credentials = await open(options.credentialsOutput, 'wx', 0o600);
            }
            const report = await app
                .get(SeedRunner)
                .run(plan, action === 'apply' ? 'apply' : 'verify', cancellation.signal);
            if (options.output) {
                await mkdir(dirname(options.output), { recursive: true });
                await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, {
                    flag: 'wx',
                });
                console.info(`[seed] Output references written to ${options.output}`);
            }
        } finally {
            try {
                try {
                    if (credentials)
                        await credentials.writeFile(
                            `${JSON.stringify(secrets.export(), null, 2)}\n`
                        );
                } finally {
                    await credentials?.close();
                    secrets.clear();
                }
            } finally {
                await app.close();
            }
        }
    } finally {
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        await target.close();
        target.client.off('error', stop);
        target.client.off('end', stop);
    }
}
