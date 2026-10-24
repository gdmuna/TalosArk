import { Option } from 'commander';
import { createCommand, type CliContext } from '../cli/context.js';
import { compileTools } from '../cli/compiled.js';
import { runNodeModule, runPnpm, requireSuccess } from '../cli/process.js';

export async function run(args: string[], _context: CliContext): Promise<void> {
    const command = createCommand('tool build').addOption(
        new Option('--target <target>', 'Build app, ops, seed or all (app + ops)')
            .choices(['app', 'ops', 'seed', 'all'])
            .default('all')
    );
    command.parse(args, { from: 'user' });
    const { target } = command.opts<{ target: string }>();
    await requireSuccess(runPnpm(['--filter', '@talos-ark/contracts', 'build']));
    if (target === 'app' || target === 'all') {
        await requireSuccess(runNodeModule('@nestjs/cli/bin/nest.js', ['build']));
        await requireSuccess(
            runNodeModule('tsc-alias/dist/bin/index.js', ['-p', 'tsconfig.build.json'])
        );
    }
    if (target === 'ops' || target === 'all') await compileTools();
    if (target === 'seed') await import('../seed/build.js');
}
