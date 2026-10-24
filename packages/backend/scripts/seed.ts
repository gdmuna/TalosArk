import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { findBackendRoot } from './backend-root.js';

const root = findBackendRoot();
async function run(command: string, args: string[]): Promise<number> {
    return new Promise((accept, reject) => {
        const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
        const interrupt = () => child.kill('SIGINT');
        const terminate = () => child.kill('SIGTERM');
        process.on('SIGINT', interrupt);
        process.on('SIGTERM', terminate);
        child.once('error', reject);
        child.once('close', (code, signal) => {
            process.off('SIGINT', interrupt);
            process.off('SIGTERM', terminate);
            accept(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1));
        });
    });
}

try {
    const pnpm = process.env.npm_execpath;
    if (!pnpm) throw new Error('Use pnpm db:seed to run the guarded seed entry');
    // tsc emits the constructor metadata required by Nest; tsx alone does not.
    const built = /\.(?:c?js|mjs)$/i.test(pnpm)
        ? await run(process.execPath, [pnpm, 'run', 'db:seed:build'])
        : await run(pnpm, ['run', 'db:seed:build']);
    process.exitCode =
        built === 0
            ? await run(process.execPath, [
                  resolve(root, '.cache/seed/tooling/seed/cli/entry.js'),
                  ...process.argv.slice(2),
              ])
            : built;
} catch (error) {
    console.error(`[seed] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
