import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CliContext } from '../cli/context.js';
import { createCommand } from '../cli/context.js';
import {
    addRuntimeEnvironment,
    loadRuntimeEnvironment,
    selectRuntimeEnvironment,
    type RuntimeEnvironmentOptions,
} from '../cli/environment/runtime.js';
import { runNodeModule, runPnpm, requireSuccess, runProcess } from '../cli/process.js';
import { findBackendRoot } from '../cli/backend-root.js';

export async function run(args: string[], context: CliContext): Promise<void> {
    const command = addRuntimeEnvironment(createCommand('tool app')).argument(
        '[action]',
        'dev | run | worker'
    );
    command.parse(args, { from: 'user' });
    const action = await context.input.choose({
        value: command.args[0],
        flag: '<action>',
        example: 'pnpm tool app dev',
        message: 'Application action:',
        choices: ['dev', 'run', 'worker'].map((value) => ({ name: value, value })),
    });
    const selected = await selectRuntimeEnvironment(
        context.input,
        command.opts<RuntimeEnvironmentOptions>(),
        action === 'dev'
            ? (candidate) =>
                  candidate.source.kind === 'file' ||
                  candidate.source.name === 'dev' ||
                  candidate.source.name === 'dev.local'
            : undefined
    );
    const env = loadRuntimeEnvironment(selected.files);
    if (action === 'dev') {
        if (env.NODE_ENV === 'production')
            throw new Error('The development watcher cannot use NODE_ENV=production.');
        await requireSuccess(runPnpm(['--filter', '@talos-ark/contracts', 'build']));
        process.exitCode = await runNodeModule(
            '@nestjs/cli/bin/nest.js',
            ['start', '--watch', '--exec', 'pnpm tsc-alias -v && node dist/src/main.js'],
            env
        );
        return;
    }
    const entry = resolve(
        findBackendRoot(),
        action === 'worker' ? 'dist/src/worker.js' : 'dist/src/main.js'
    );
    if (!existsSync(entry)) throw new Error('Application build is missing. Run pnpm build first.');
    process.exitCode = await runProcess(process.execPath, [entry], { env });
}
