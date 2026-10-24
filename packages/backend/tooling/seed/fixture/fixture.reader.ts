import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, open, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import {
    fixtureFileRefSchema,
    type FixtureFileFacts,
    type FixtureFileRef,
} from './fixture.definition.js';

const maxSize = 100 * 1024 ** 2;
function within(root: string, file: string): boolean {
    const part = relative(root, file);
    return (
        !!part &&
        part !== '..' &&
        !part.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
        !isAbsolute(part)
    );
}

export class PreparedFixtures {
    private readonly entries = new Map<string, { facts: FixtureFileFacts; path?: string }>();
    private directory?: string;
    private closed = false;

    static async prepare(
        refs: readonly FixtureFileRef[],
        root: string,
        snapshot: boolean,
        signal?: AbortSignal
    ): Promise<PreparedFixtures> {
        const prepared = new PreparedFixtures();
        try {
            signal?.throwIfAborted();
            if (!refs.length) return prepared;
            const allowed = await realpath(root).catch(() => {
                throw new Error('Seed fixture root is missing or unreadable');
            });
            if (snapshot)
                prepared.directory = await mkdtemp(join(tmpdir(), 'talosark-seed-input-'));
            for (const ref of [
                ...new Map(refs.map((ref) => [ref.id, fixtureFileRefSchema.parse(ref)])).values(),
            ].sort((a, b) => a.id.localeCompare(b.id))) {
                signal?.throwIfAborted();
                const file = await realpath(resolve(allowed, ref.id)).catch(() => {
                    throw new Error(`Seed fixture is missing: ${ref.id}`);
                });
                if (!within(allowed, file))
                    throw new Error(`Seed fixture escapes its allowed root: ${ref.id}`);
                const source = await open(file, 'r');
                const destination = prepared.directory
                    ? join(prepared.directory, String(prepared.entries.size))
                    : undefined;
                let output: Awaited<ReturnType<typeof open>> | undefined;
                try {
                    output = destination ? await open(destination, 'wx', 0o600) : undefined;
                    const before = await source.stat({ bigint: true });
                    if (!before.isFile() || before.size > BigInt(maxSize))
                        throw new Error(
                            `Seed fixture must be a regular file of at most 100 MiB: ${ref.id}`
                        );
                    const hash = createHash('sha256');
                    let sizeBytes = 0;
                    for await (const chunk of source.createReadStream({ autoClose: false })) {
                        signal?.throwIfAborted();
                        if (!Buffer.isBuffer(chunk))
                            throw new Error('Unexpected seed fixture stream encoding');
                        sizeBytes += chunk.length;
                        if (sizeBytes > maxSize)
                            throw new Error(`Seed fixture exceeds 100 MiB: ${ref.id}`);
                        hash.update(chunk);
                        if (output) await output.writeFile(chunk);
                    }
                    const after = await source.stat({ bigint: true });
                    if (
                        before.size !== after.size ||
                        before.mtimeNs !== after.mtimeNs ||
                        before.ctimeNs !== after.ctimeNs ||
                        BigInt(sizeBytes) !== after.size
                    )
                        throw new Error(`Seed fixture changed while reading: ${ref.id}`);
                    prepared.entries.set(ref.id, {
                        facts: Object.freeze({ id: ref.id, sizeBytes, sha256: hash.digest('hex') }),
                        path: destination,
                    });
                } finally {
                    try {
                        await output?.close();
                    } finally {
                        await source.close();
                    }
                }
            }
            return prepared;
        } catch (error) {
            await prepared.close();
            throw error;
        }
    }

    facts(): readonly FixtureFileFacts[] {
        return Object.freeze([...this.entries.values()].map((entry) => entry.facts));
    }
    get(id: string): FixtureFileFacts {
        const entry = this.entries.get(id);
        if (this.closed || !entry) throw new Error(`Seed fixture was not prepared: ${id}`);
        return entry.facts;
    }
    body(id: string, start: number, length: number): ReadableStream<Uint8Array> {
        const facts = this.get(id);
        if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(length) ||
            start < 0 ||
            length < 0 ||
            start + length > facts.sizeBytes
        )
            throw new Error('Invalid seed fixture byte range');
        const file = this.entries.get(id)?.path;
        if (!file) throw new Error('Only snapshotted seed files can be uploaded');
        if (length === 0)
            return new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.close();
                },
            });
        const iterator = createReadStream(file, { start, end: start + length - 1 })[
            Symbol.asyncIterator
        ]();
        return new ReadableStream<Uint8Array>({
            async pull(controller) {
                try {
                    const next = await iterator.next();
                    if (next.done) controller.close();
                    else if (Buffer.isBuffer(next.value)) controller.enqueue(next.value);
                    else throw new Error('Unexpected seed fixture encoding');
                } catch (error) {
                    controller.error(error);
                }
            },
            async cancel() {
                await iterator.return?.();
            },
        });
    }
    async close(): Promise<void> {
        this.closed = true;
        if (!this.directory) return;
        const directory = resolve(this.directory);
        if (
            !within(resolve(tmpdir()), directory) ||
            !basename(directory).startsWith('talosark-seed-input-')
        )
            throw new Error('Invalid seed input cleanup path');
        await rm(directory, { recursive: true, force: true });
        this.directory = undefined;
    }
}
