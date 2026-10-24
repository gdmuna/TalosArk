import { mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { SeedRunResult } from './result.js';

export async function reserveSeedReport(path: string) {
    await mkdir(dirname(resolve(path)), { recursive: true });
    return open(path, 'wx', 0o644);
}

export async function writeSeedReport(
    file: Awaited<ReturnType<typeof reserveSeedReport>>,
    result: SeedRunResult
): Promise<void> {
    const content = Buffer.from(`${JSON.stringify(result, null, 2)}\n`);
    await file.truncate(0);
    let offset = 0;
    while (offset < content.length) {
        const { bytesWritten } = await file.write(content, offset, content.length - offset, offset);
        if (!bytesWritten) throw new Error('Seed report write made no progress');
        offset += bytesWritten;
    }
    await file.sync();
}
