import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Nest constructor metadata is emitted by tsc, not tsx/esbuild.
const entry = fileURLToPath(new URL('../dist/tooling/seed/seed.entry.js', import.meta.url));
if (!existsSync(entry)) {
    console.error('[seed] Compiled seed entry is missing. Run pnpm db:seed:build first.');
    process.exitCode = 1;
} else {
    const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], { stdio: 'inherit' });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    child.once('error', (error) => {
        console.error(`[seed] Unable to start seed entry: ${error.message}`);
        process.exitCode = 1;
    });
    child.once('close', (code, signal) => {
        process.off('SIGINT', interrupt);
        process.off('SIGTERM', terminate);
        process.exitCode = code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1);
    });
}
