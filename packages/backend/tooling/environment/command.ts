import { Option } from 'commander';
import { createCommand, type CliContext } from '../cli/context.js';
import { RUNTIME_ENVIRONMENT_PROFILES } from '../cli/environment/runtime.js';
import { createEnvironmentCatalog } from '../cli/environment/catalog.js';
import { PRISMA_ENVIRONMENT_FILES } from '../database/environment.js';
import { runPnpm } from '../cli/process.js';
import { findBackendRoot } from '../cli/backend-root.js';
import { resolve } from 'node:path';

export async function run(args: string[], context: CliContext): Promise<void> {
    const command = createCommand('tool env')
        .argument('[action]', 'encrypt | decrypt')
        .addOption(
            new Option('--scope <scope>', 'Configuration family').choices(['runtime', 'database'])
        )
        .addOption(new Option('--env <profile>', 'Profile to process').conflicts('envFile'))
        .option('--env-file <path>', 'One explicit environment file');
    command.parse(args, { from: 'user' });
    const options = command.opts();
    const action = await context.input.choose({
        value: command.args[0],
        flag: '<action>',
        message: 'Environment operation:',
        example: 'pnpm tool env encrypt',
        choices: ['encrypt', 'decrypt'].map((value) => ({ name: value, value })),
    });
    const scope = await context.input.choose({
        value: options.scope,
        flag: '--scope',
        message: 'Configuration family:',
        example: '--scope runtime',
        choices: ['runtime', 'database'].map((value) => ({ name: value, value })),
    });
    const profiles =
        scope === 'runtime'
            ? Object.fromEntries(
                  Object.entries(RUNTIME_ENVIRONMENT_PROFILES).map(([name, files]) => [
                      name,
                      [files[0]],
                  ])
              )
            : Object.fromEntries(
                  Object.entries(PRISMA_ENVIRONMENT_FILES).map(([name, file]) => [name, [file]])
              );
    const catalog = createEnvironmentCatalog({
        directory: resolve(
            findBackendRoot(),
            scope === 'runtime' ? 'secrets/env' : 'ops/prisma/env'
        ),
        profiles,
    });
    const selected = await catalog.selectWithInput(
        context.input,
        options.env !== undefined
            ? { kind: 'profile', name: options.env }
            : options.envFile !== undefined
              ? { kind: 'file', path: options.envFile }
              : undefined
    );
    // A local profile selects its own file; inheritance is only for reading configuration.
    process.exitCode = await runPnpm(['exec', 'dotenvx', action, '-f', selected.files[0]]);
}
