import { readFile } from 'node:fs/promises';
import { Option } from 'commander';
import { z } from 'zod';
import { SeedApplication, type SeedPlanRequest, type SeedStorageSource } from '../index.js';
import { InputResolver } from '../../cli/input.js';
import { createCommand, finish, type CliContext } from '../../cli/context.js';
import { runPnpm, runProcess } from '../../cli/process.js';
import { findBackendRoot } from '../../cli/backend-root.js';
import { resolve } from 'node:path';

function createSeedCommand() {
    return createCommand('seed')
        .description('Plan, execute, inspect and explicitly resume development/test datasets')
        .argument('[action]', 'list | plan | init | apply | verify | resume | status | report')
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
        .addOption(
            new Option('--params <json>', 'Dataset/group parameters').conflicts('paramsFile')
        )
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
            new Option('--storage-config <path>', 'Explicit storage-only JSON').conflicts(
                'storageEnv'
            )
        )
        .addOption(
            new Option(
                '--storage-env <profile>',
                'Explicit runtime profile; only storage fields are consumed'
            ).choices(['dev', 'dev.local', 'test', 'test.local'])
        );
}

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

async function execute(args: string[], context: CliContext): Promise<void> {
    const command = createSeedCommand();
    command.parse(args, { from: 'user' });
    const action = await context.input.choose({
        value: command.args[0],
        flag: '<action>',
        message: 'Seed operation:',
        example: 'pnpm seed list',
        choices: ['list', 'plan', 'init', 'apply', 'verify', 'resume', 'status', 'report'].map(
            (value) => ({ name: value, value })
        ),
    });
    const options = command.opts<Options>();
    const selectionProvided =
        options.group !== undefined || options.dataset !== undefined || options.tag !== undefined;
    const seed = new SeedApplication({ fixtureRoot: options.fixtureRoot });
    if (action === 'list') {
        console.info(JSON.stringify(seed.list(), null, 2));
        return;
    }
    if (!['plan', 'init', 'apply', 'verify', 'resume', 'status', 'report'].includes(action))
        throw new Error(`Unknown action ${action}`);
    let plan: SeedPlanRequest | undefined;
    const namespace = ['plan', 'apply', 'verify', 'resume', 'status', 'report'].includes(action)
        ? await context.input.text({
              value: options.namespace,
              flag: '--namespace',
              example: '--namespace material-demo',
              message: 'Seed namespace:',
          })
        : undefined;
    const seedNamespace = namespace ?? '';
    if (['plan', 'apply', 'verify', 'resume'].includes(action)) {
        if (!selectionProvided) {
            const catalog = seed.list();
            const selection = await context.input.choose({
                flag: '--group, --dataset or --tag',
                message: 'Seed dataset or group:',
                example: '--group minimal',
                choices: [
                    ...catalog.groups.map((group) => ({
                        name: `group: ${group.id}`,
                        description: group.description,
                        value: { kind: 'group', id: group.id },
                    })),
                    ...catalog.datasets
                        .filter((dataset) => dataset.selection === 'independent')
                        .map((dataset) => ({
                            name: `dataset: ${dataset.id}`,
                            description: dataset.description,
                            value: { kind: 'dataset', id: dataset.id },
                        })),
                ],
            });
            if (selection.kind === 'group') options.group = selection.id;
            else options.dataset = selection.id;
        }
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
            namespace: seedNamespace,
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
    const database = await context.input.text({
        value: options.database,
        flag: '--database',
        example: '--database talos_ark_dev',
        message: 'Confirm the connected database name:',
    });
    const { choosePrismaEnvironment } = await import('../../database/environment.js');
    const environment = await choosePrismaEnvironment(
        options.env !== undefined
            ? { kind: 'profile', name: options.env }
            : options.envFile !== undefined
              ? { kind: 'file', path: options.envFile }
              : undefined,
        context.input
    );
    const target = { environment, expectedDatabase: database };
    if (action === 'init') {
        await seed.initialize(target, options.purpose);
        console.info(
            '[seed] Seed metadata initialized; business tables and extensions were not changed.'
        );
        return;
    }
    if (action === 'status' || action === 'report') {
        if (action === 'status') {
            const inspection = await seed.inspect(target, seedNamespace);
            console.info(
                JSON.stringify(
                    { ...inspection, run: { ...inspection.run, report: undefined } },
                    null,
                    2
                )
            );
        } else {
            const output = await context.input.text({
                value: options.output,
                flag: '--output',
                example: '--output .cache/seed/report.json',
                message: 'Report output path:',
            });
            await seed.exportReport(target, seedNamespace, output);
            console.info('[seed] Stored report exported; no business operation was replayed.');
        }
        return;
    }
    if (import.meta.url.endsWith('.ts')) {
        const { requireSuccess } = await import('../../cli/process.js');
        await requireSuccess(runPnpm(['run', 'db:seed:build']));
        const completed = [...args];
        if (!command.args.length) completed.unshift(action);
        if (!selectionProvided && options.group) completed.push('--group', options.group);
        else if (!selectionProvided && options.dataset)
            completed.push('--dataset', options.dataset);
        if (options.namespace === undefined) completed.push('--namespace', seedNamespace);
        if (options.database === undefined) completed.push('--database', database);
        if (options.env === undefined && options.envFile === undefined)
            completed.push(
                '--env-file',
                environment.kind === 'file'
                    ? environment.path
                    : (await import('../../database/environment.js')).loadPrismaEnvironment(
                          environment
                      ).filePath
            );
        process.exitCode = await runProcess(process.execPath, [
            resolve(findBackendRoot(), '.cache/seed/tooling/seed/cli/entry.js'),
            ...completed,
        ]);
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

export async function run(args: string[], context: CliContext): Promise<void> {
    try {
        await execute(args, context);
    } catch (error) {
        if (error instanceof z.ZodError)
            throw new Error(
                `Invalid seed definition or request: ${error.issues.map((issue) => `${issue.path.join('.') || '<root>'} (${issue.code})`).join(', ')}`,
                { cause: error }
            );
        throw error;
    }
}

if (process.argv[1]?.replaceAll('\\', '/').includes('/tooling/seed/cli/entry.')) {
    await finish(() => run(process.argv.slice(2), { input: new InputResolver(false) }));
}
