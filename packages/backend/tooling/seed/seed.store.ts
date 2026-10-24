import type { DatabaseRuntime } from '../../src/infra/database/database.runtime.js';
import { seedJson, type SeedJson } from './seed.definition.js';

interface RunRow {
    plan_hash: string;
    status: 'running' | 'completed' | 'failed';
}
interface RecordRow {
    key: string;
    output: SeedJson;
    snapshot_hash: string;
    final_snapshot_hash: string | null;
}

export class SeedStore {
    constructor(private readonly database: DatabaseRuntime) {}

    async run(namespace: string): Promise<RunRow | undefined> {
        const rows = await this.database.queryClient.$queryRawUnsafe<RunRow[]>(
            'SELECT plan_hash, status FROM seed.run WHERE namespace = $1',
            namespace
        );
        return rows[0];
    }

    async start(namespace: string, plan: unknown, hash: string): Promise<void> {
        await this.database.queryClient.$executeRawUnsafe(
            "INSERT INTO seed.run(namespace, plan_hash, plan, status) VALUES ($1, $2, $3::jsonb, 'running')",
            namespace,
            hash,
            JSON.stringify(seedJson(plan))
        );
    }

    async finish(namespace: string, status: 'completed' | 'failed'): Promise<void> {
        await this.database.queryClient.$executeRawUnsafe(
            'UPDATE seed.run SET status = $2, completed_at = now() WHERE namespace = $1',
            namespace,
            status
        );
    }

    records(namespace: string, step: string): Promise<RecordRow[]> {
        return this.database.queryClient.$queryRawUnsafe<RecordRow[]>(
            'SELECT key, output, snapshot_hash, final_snapshot_hash FROM seed.record WHERE namespace = $1 AND step = $2 ORDER BY key',
            namespace,
            step
        );
    }

    async finalize(namespace: string, step: string, key: string, hash: string): Promise<void> {
        const count = await this.database.queryClient.$executeRawUnsafe(
            'UPDATE seed.record SET final_snapshot_hash = $4 WHERE namespace = $1 AND step = $2 AND key = $3 AND final_snapshot_hash IS NULL',
            namespace,
            step,
            key,
            hash
        );
        if (count !== 1) throw new Error(`Unable to finalize seed receipt ${step}/${key}`);
    }

    async requireFinalSnapshots(namespace: string): Promise<void> {
        const rows = await this.database.queryClient.$queryRawUnsafe<{ missing: bigint }[]>(
            'SELECT count(*) AS missing FROM seed.record WHERE namespace = $1 AND final_snapshot_hash IS NULL',
            namespace
        );
        if (rows[0].missing !== 0n)
            throw new Error(
                'Completed seed run is missing final snapshots; automatic adoption is disabled'
            );
    }

    async append(
        namespace: string,
        step: string,
        key: string,
        output: unknown,
        snapshotHash: string
    ): Promise<void> {
        await this.database.queryClient.$executeRawUnsafe(
            'INSERT INTO seed.record(namespace, step, key, output, snapshot_hash) VALUES ($1, $2, $3, $4::jsonb, $5)',
            namespace,
            step,
            key,
            JSON.stringify(seedJson(output)),
            snapshotHash
        );
    }
}
