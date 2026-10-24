import { spawn } from 'node:child_process';
import { cp, mkdir, access, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, relative, isAbsolute } from 'node:path';
import { findBackendRoot } from './backend-root.js';

const root = findBackendRoot();
const require = createRequire(import.meta.url);
async function run(entry: string, args: string[]): Promise<void> {
    await new Promise<void>((accept, reject) => {
        const child = spawn(process.execPath, [entry, ...args], { cwd: root, stdio: 'inherit' });
        child.once('error', reject);
        child.once('close', (code) =>
            code === 0 ? accept() : reject(new Error(`Seed compiler exited with status ${code}`))
        );
    });
}

try {
    await access(resolve(root, 'prisma/generated/client.ts')).catch(() => {
        throw new Error(
            'Prisma client is missing. Run pnpm db:gen-client with an explicitly selected environment; no schema changes are applied.'
        );
    });
    await run(require.resolve('typescript/lib/tsc.js'), ['-p', 'tsconfig.seed.json']);
    await run(require.resolve('tsc-alias/dist/bin/index.js'), ['-p', 'tsconfig.seed.json']);
    const output = resolve(root, '.cache/seed/tooling/seed');
    await mkdir(resolve(output, 'runtime'), { recursive: true });
    await cp(
        resolve(root, 'tooling/seed/runtime/schema.sql'),
        resolve(output, 'runtime/schema.sql')
    );
    const fixtureOutput = resolve(output, 'fixture/file');
    const withinOutput = relative(resolve(root, '.cache/seed'), fixtureOutput);
    if (!withinOutput || withinOutput.startsWith('..') || isAbsolute(withinOutput))
        throw new Error('Invalid seed fixture output path');
    await rm(fixtureOutput, { recursive: true, force: true });
    await cp(resolve(root, 'tooling/seed/fixture/file'), fixtureOutput, {
        recursive: true,
    });
} catch (error) {
    console.error(`[seed] Build failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
