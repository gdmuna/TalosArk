import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { findBackendRoot } from './backend-root.js';

const require = createRequire(import.meta.url);

export function runProcess(
    command: string,
    args: readonly string[],
    options: {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
    } = {}
): Promise<number> {
    return new Promise((accept, reject) => {
        const child = spawn(command, [...args], {
            cwd: options.cwd ?? findBackendRoot(),
            env: options.env ?? process.env,
            stdio: 'inherit',
        });
        const interrupt = () => child.kill('SIGINT');
        const terminate = () => child.kill('SIGTERM');
        process.on('SIGINT', interrupt);
        process.on('SIGTERM', terminate);
        const cleanup = () => {
            process.off('SIGINT', interrupt);
            process.off('SIGTERM', terminate);
        };
        child.once('error', (error) => {
            cleanup();
            reject(error);
        });
        child.once('close', (code, signal) => {
            cleanup();
            accept(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1));
        });
    });
}

export function runNodeModule(entry: string, args: readonly string[], env?: NodeJS.ProcessEnv) {
    return runProcess(process.execPath, [require.resolve(entry), ...args], { env });
}

export function runPnpm(args: readonly string[]) {
    const path = process.env.npm_execpath;
    if (path)
        return /\.(?:c?js|mjs)$/i.test(path)
            ? runProcess(process.execPath, [path, ...args])
            : runProcess(path, args);
    const executable =
        process.platform === 'win32' ? resolve(process.env.PNPM_HOME ?? '', 'pnpm.exe') : 'pnpm';
    if (process.platform === 'win32' && !existsSync(executable))
        throw new Error(
            'Use a pnpm script to run this tool so the package manager path is available.'
        );
    return runProcess(executable, args);
}

export async function requireSuccess(work: Promise<number>): Promise<void> {
    const code = await work;
    if (code !== 0) {
        process.exitCode = code;
        throw new Error(`Subprocess exited with status ${code}.`);
    }
}
