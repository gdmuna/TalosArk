import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function findBackendRoot(from: string = import.meta.url): string {
    let directory = dirname(fileURLToPath(from));
    for (;;) {
        if (existsSync(join(directory, 'prisma.config.ts'))) return directory;
        const parent = dirname(directory);
        if (parent === directory) throw new Error('Unable to locate the backend workspace');
        directory = parent;
    }
}
