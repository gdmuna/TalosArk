import type { CliContext } from '../cli/context.js';
import { createCommand } from '../cli/context.js';
import {
    addRuntimeEnvironment,
    loadRuntimeEnvironment,
    selectRuntimeEnvironment,
} from '../cli/environment/runtime.js';
import { runNodeModule } from '../cli/process.js';

export async function run(args: string[], context: CliContext): Promise<void> {
    const command = addRuntimeEnvironment(createCommand('tool test'))
        .option('--watch', 'Watch tests')
        .option('--coverage', 'Collect coverage')
        .allowUnknownOption()
        .argument('[file...]', 'Optional Vitest file filters');
    command.parse(args, { from: 'user' });
    const options = command.opts<{
        env?: string;
        envFile?: string[];
        envProcess?: boolean;
        watch?: boolean;
        coverage?: boolean;
    }>();
    const selected = await selectRuntimeEnvironment(context.input, options);
    const env = loadRuntimeEnvironment(selected.files);
    if (env.NODE_ENV === 'production') throw new Error('Tests cannot use NODE_ENV=production.');
    process.exitCode = await runNodeModule(
        'vitest/vitest.mjs',
        [
            ...(options.watch ? [] : ['run']),
            ...(options.coverage ? ['--coverage'] : []),
            ...command.args,
        ],
        env
    );
}
