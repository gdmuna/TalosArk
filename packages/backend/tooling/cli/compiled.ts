import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBackendRoot } from './backend-root.js';
import { runNodeModule, runPnpm, requireSuccess, runProcess } from './process.js';

export async function compileTools(output = 'dist'): Promise<void> {
    await requireSuccess(
        runNodeModule('typescript/lib/tsc.js', [
            '-p',
            'tsconfig.tooling.json',
            '--outDir',
            output,
            '--tsBuildInfoFile',
            `${output}/tsconfig.tooling.tsbuildinfo`,
        ])
    );
    await requireSuccess(
        runNodeModule('tsc-alias/dist/bin/index.js', [
            '-p',
            'tsconfig.tooling.json',
            '--outDir',
            output,
        ])
    );
}

export async function invokeRuntime(
    kind: 'account' | 'task',
    payload: unknown,
    env: NodeJS.ProcessEnv = process.env
): Promise<void> {
    const source = fileURLToPath(import.meta.url).endsWith('.ts');
    const root = findBackendRoot();
    const output = source ? '.cache/ops' : 'dist';
    if (source) {
        await requireSuccess(runPnpm(['--filter', '@talos-ark/contracts', 'build']));
        await compileTools(output);
    }
    const entry = resolve(root, output, 'tooling/cli/runtime-entry.js');
    if (!existsSync(entry)) throw new Error('Operational runtime is missing; run pnpm build.');
    process.exitCode = await runProcess(process.execPath, [entry, kind, JSON.stringify(payload)], {
        env,
    });
}
