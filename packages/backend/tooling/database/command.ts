import { resolve } from 'node:path';
import { Option } from 'commander';
import { createCommand, type CliContext } from '../cli/context.js';
import { findBackendRoot } from '../cli/backend-root.js';
import { run as runPrisma } from './prisma.js';

const ddl = ['identity', 'storage-node', 'inventory', 'approval'] as const;

export async function run(args: string[], context: CliContext): Promise<void> {
    if (args[0] === '--help' || args[0] === '-h') {
        createCommand('tool db')
            .argument('[action]', 'init | prisma | ddl | seed')
            .addHelpText(
                'after',
                '\nExamples:\n  pnpm db init --env dev.local\n  pnpm db ddl apply --only identity,storage-node --env dev.local\n  pnpm prisma generate --env dev.local\n'
            )
            .outputHelp();
        return;
    }
    const action = await context.input.choose({
        value: args[0],
        flag: '<action>',
        message: 'Database operation:',
        example: 'pnpm db init --env dev.local',
        choices: ['init', 'prisma', 'ddl', 'seed'].map((value) => ({ name: value, value })),
    });
    const rest = args.length ? args.slice(1) : [];
    if (action === 'prisma' || action === 'init') {
        await runPrisma(action === 'init' ? ['--init', ...rest] : rest, context);
    } else if (action === 'seed') {
        const entry = '../seed/cli/entry.js';
        await (await import(entry)).run(rest, context);
    } else {
        const command = createCommand('tool db ddl')
            .argument('[action]', 'apply')
            .option('--only <names>', `Comma-separated DDL names: ${ddl.join(', ')}`)
            .addOption(
                new Option('--env <profile>', 'Prisma database profile').conflicts('envFile')
            )
            .option('--env-file <path>', 'Explicit Prisma environment file');
        command.parse(rest, { from: 'user' });
        await context.input.choose({
            value: command.args[0],
            flag: '<action>',
            message: 'DDL operation:',
            example: 'pnpm db ddl apply',
            choices: [{ name: 'apply', value: 'apply' }],
        });
        const options = command.opts();
        const selected = await context.input.text({
            value: options.only,
            flag: '--only',
            message: `DDL names (${ddl.join(', ')}):`,
            example: '--only identity,storage-node,inventory,approval',
            parse: (value) => {
                if (typeof value !== 'string')
                    throw new Error('Provide comma-separated DDL names.');
                const names = value.split(',').map((name) => name.trim());
                if (names.some((name) => !ddl.includes(name as (typeof ddl)[number])))
                    throw new Error(`Allowed DDL names: ${ddl.join(', ')}`);
                return names.join(',');
            },
        });
        const { choosePrismaEnvironment, loadPrismaEnvironment } = await import('./environment.js');
        const source = await choosePrismaEnvironment(
            options.env !== undefined
                ? { kind: 'profile', name: options.env }
                : options.envFile !== undefined
                  ? { kind: 'file', path: options.envFile }
                  : undefined,
            context.input
        );
        const environment = loadPrismaEnvironment(source);
        for (const name of ddl.filter((name) => selected.split(',').includes(name))) {
            await runPrisma(
                [
                    'db',
                    'execute',
                    '--file',
                    resolve(findBackendRoot(), `prisma/ddl/schema/${name}.sql`),
                    '--env-file',
                    environment.filePath,
                ],
                context
            );
            if (process.exitCode) return;
        }
    }
}
