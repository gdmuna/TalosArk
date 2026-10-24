import { readFile } from 'node:fs/promises';
import { Command, Option } from 'commander';
import { z } from 'zod';
import { SeedApplication, type SeedPlanRequest, type SeedStorageSource } from '../index.js';

const command = new Command('db:seed')
    .description('Plan, execute, inspect and explicitly resume development/test datasets')
    .argument('<action>', 'list | plan | init | apply | verify | resume | status | report')
    .addOption(new Option('--env <profile>', 'Prisma-only environment').conflicts('envFile'))
    .option('--env-file <path>', 'Explicit Prisma-only environment file')
    .option('--database <name>', 'Confirm the actual connected database name')
    .addOption(
        new Option(
            '--purpose <purpose>',
            'Legacy init label; no longer required or persisted'
        ).choices(['development', 'test'])
    )
    .option('--namespace <name>', 'Stable, unique fixture namespace')
    .option('--actor <uuid>', 'Existing local actor; omit to provision an account')
    .option('--organization <uuid>', 'Existing organization; requires --workspace and --actor')
    .option('--workspace <uuid>', 'Existing workspace; requires --organization and --actor')
    .option('--group <id>', 'Named dataset composition')
    .option('--dataset <id>', 'Independently selectable dataset')
    .option(
        '--tag <tag...>',
        'Independent datasets matching every tag; volume selection is explicit only'
    )
    .addOption(new Option('--params <json>', 'Dataset/group parameters').conflicts('paramsFile'))
    .option('--params-file <path>', 'Parameters from a JSON file')
    .option('--seed <integer>', 'Deterministic generation seed', '42')
    .option('--reference-date <date>', 'Generation date, not the business clock', '2026-01-01')
    .option('--fixture-root <path>', 'Allowed local input-file root')
    .option('--expected-fingerprint <hash>', 'Refuse execution if the rebuilt plan differs')
    .option('--output <path>', 'Exclusive JSON report destination')
    .option(
        '--credentials-output <path>',
        'Plaintext private JSON; resume requires the original batch file'
    )
    .addOption(
        new Option('--storage-config <path>', 'Explicit storage-only JSON').conflicts('storageEnv')
    )
    .addOption(
        new Option(
            '--storage-env <profile>',
            'Explicit runtime profile; only storage fields are consumed'
        ).choices(['dev', 'dev.local', 'test', 'test.local'])
    );

interface Options {
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
    fixtureRoot?: string;
    expectedFingerprint?: string;
    output?: string;
    credentialsOutput?: string;
    storageConfig?: string;
    storageEnv?: Extract<SeedStorageSource, { kind: 'profile' }>['name'];
}

async function main(): Promise<void> {
    command.parse();
    const [action] = command.args;
    const options = command.opts<Options>();
    const seed = new SeedApplication({ fixtureRoot: options.fixtureRoot });
    if (action === 'list') {
        console.info(JSON.stringify(seed.list(), null, 2));
        return;
    }
    if (!['plan', 'init', 'apply', 'verify', 'resume', 'status', 'report'].includes(action))
        throw new Error(`Unknown action ${action}`);
    let plan: SeedPlanRequest | undefined;
    if (['plan', 'apply', 'verify', 'resume'].includes(action)) {
        if (!options.namespace) throw new Error('plan/apply/verify/resume require --namespace');
        if (Number(!!options.group) + Number(!!options.dataset) + Number(!!options.tag) !== 1)
            throw new Error('Choose exactly one of --group, --dataset or --tag');
        if (!!options.organization !== !!options.workspace || (options.workspace && !options.actor))
            throw new Error(
                'Existing scope requires --actor, --organization and --workspace together'
            );
        const parameters: unknown = options.paramsFile
            ? JSON.parse(await readFile(options.paramsFile, 'utf8'))
            : options.params
              ? JSON.parse(options.params)
              : {};
        if (options.tag && (options.params || options.paramsFile))
            throw new Error('Tag selection does not accept shared parameters');
        const json = z.json().parse(parameters);
        plan = {
            namespace: options.namespace,
            selection: options.group
                ? { kind: 'group', id: options.group, parameters: json }
                : options.dataset
                  ? { kind: 'dataset', id: options.dataset, parameters: json }
                  : { kind: 'tags', tags: options.tag ?? [] },
            generation: { seed: Number(options.seed), referenceDate: options.referenceDate },
            scope: options.actor
                ? options.organization && options.workspace
                    ? {
                          kind: 'workspace',
                          userId: options.actor,
                          organizationId: options.organization,
                          workspaceId: options.workspace,
                      }
                    : { kind: 'actor', userId: options.actor }
                : { kind: 'provision' },
        };
    }
    if (action === 'plan') {
        if (!plan) throw new Error('Missing seed plan request');
        console.info(JSON.stringify(await seed.plan(plan), null, 2));
        return;
    }
    if (!options.database) throw new Error('--database is required for connected commands');
    const { choosePrismaEnvironment } = await import('../../../scripts/prisma-environment.js');
    const environment = await choosePrismaEnvironment(
        options.env
            ? { kind: 'profile', name: options.env }
            : options.envFile
              ? { kind: 'file', path: options.envFile }
              : undefined
    );
    const target = { environment, expectedDatabase: options.database };
    if (action === 'init') {
        await seed.initialize(target, options.purpose);
        console.info(
            '[seed] Seed metadata initialized; business tables and extensions were not changed.'
        );
        return;
    }
    if (action === 'status' || action === 'report') {
        if (!options.namespace) throw new Error('status/report require --namespace');
        if (action === 'status') {
            const inspection = await seed.inspect(target, options.namespace);
            console.info(
                JSON.stringify(
                    { ...inspection, run: { ...inspection.run, report: undefined } },
                    null,
                    2
                )
            );
        } else {
            if (!options.output)
                throw new Error('report requires an exclusive --output destination');
            await seed.exportReport(target, options.namespace, options.output);
            console.info('[seed] Stored report exported; no business operation was replayed.');
        }
        return;
    }
    const cancellation = new AbortController();
    const stop = () =>
        cancellation.abort(new Error('Seed interrupted; committed receipts are retained'));
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    try {
        if (!plan) throw new Error('Missing seed plan request');
        const result = await seed.run(
            {
                plan,
                mode: action === 'apply' ? 'apply' : action === 'resume' ? 'resume' : 'verify',
                target,
                expectedFingerprint: options.expectedFingerprint,
                storageSource: options.storageConfig
                    ? { kind: 'json', path: options.storageConfig }
                    : options.storageEnv
                      ? { kind: 'profile', name: options.storageEnv }
                      : undefined,
                artifacts: { output: options.output, credentialsOutput: options.credentialsOutput },
            },
            cancellation.signal
        );
        console.info(
            `[seed] Execution: ${result.execution}; delivery: ${result.delivery}; namespace: ${result.namespace}`
        );
        const counts = new Map<string, number>();
        for (const item of result.verification)
            counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
        if (counts.size)
            console.info(
                `[seed] Verification: ${[...counts].map(([status, count]) => `${status}=${count}`).join(', ')}`
            );
        for (const issue of result.diagnostics)
            console.error(
                `[seed] ${issue.stage} / ${issue.code}${issue.step ? ` / ${issue.step}` : ''}${issue.key ? ` / ${issue.key}` : ''}: ${issue.message}`
            );
        if (result.execution === 'cancelled') process.exitCode = 130;
        else if (
            result.delivery === 'failed' ||
            result.diagnostics.some((item) => item.stage === 'cleanup')
        )
            process.exitCode = 1;
        else if (result.execution === 'partial') process.exitCode = 2;
        else if (result.execution !== 'completed') process.exitCode = 1;
    } finally {
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
    }
}

try {
    await main();
} catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
        console.info('[seed] Selection canceled; nothing was executed.');
        process.exitCode = 130;
    } else {
        // Validation messages can contain input values; only emit paths and issue codes.
        console.error(
            error instanceof z.ZodError
                ? `[seed] Invalid definition or request: ${error.issues.map((issue) => `${issue.path.join('.') || '<root>'} (${issue.code})`).join(', ')}`
                : `[seed] ${error instanceof Error ? error.message : String(error)}`
        );
        process.exitCode = 1;
    }
}
