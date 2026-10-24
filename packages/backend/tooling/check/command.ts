import { Option } from 'commander';
import { createCommand, type CliContext } from '../cli/context.js';
import { runNodeModule, requireSuccess } from '../cli/process.js';

const projects = {
    app: 'tsconfig.build.json',
    tooling: 'tsconfig.tooling.json',
    seed: 'tsconfig.seed.json',
} as const;

export async function run(args: string[], _context: CliContext): Promise<void> {
    const command = createCommand('tool check').addOption(
        new Option('--scope <scope>', 'TypeScript project')
            .choices([...Object.keys(projects), 'all'])
            .default('all')
    );
    command.parse(args, { from: 'user' });
    const { scope } = command.opts<{ scope: keyof typeof projects | 'all' }>();
    for (const [name, project] of Object.entries(projects)) {
        if (scope !== 'all' && scope !== name) continue;
        console.error(`[tool] Checking ${name}`);
        await requireSuccess(
            runNodeModule('typescript/lib/tsc.js', [
                '--noEmit',
                '--incremental',
                'false',
                '-p',
                project,
            ])
        );
    }
}
