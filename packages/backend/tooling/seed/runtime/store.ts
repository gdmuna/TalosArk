import type { DatabaseRuntime } from '../../../src/infra/database/database.runtime.js';
import { randomUUID } from 'node:crypto';
import { seedJson, type SeedJson } from '../definition/value.js';
import type { SeedRunResult } from './result.js';

export interface SeedRunRow {
    plan_hash: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled' | 'uncertain';
    format_version: number | null;
    execution_version: number;
    attempt_id: string | null;
    report: SeedRunResult | null;
}
export interface SeedRecordRow {
    key: string;
    output: SeedJson;
    snapshot_hash: string;
    final_snapshot_hash: string | null;
}
export interface SeedSnapshot {
    step: string;
    key: string;
    hash: string;
}
export interface SeedOperationRow {
    idempotency_key: string;
    checkpoint: SeedJson;
}

export class SeedStore {
    constructor(private readonly database: DatabaseRuntime) {}

    async run(namespace: string): Promise<SeedRunRow | undefined> {
        const rows = await this.database.queryClient.$queryRawUnsafe<SeedRunRow[]>(
            "SELECT plan_hash, status, execution_version, attempt_id, report, (plan->>'formatVersion')::int AS format_version FROM seed.run WHERE namespace = $1",
            namespace
        );
        return rows[0];
    }

    async start(namespace: string, plan: unknown, hash: string, attemptId: string): Promise<void> {
        await this.database.queryClient.$executeRawUnsafe(
            "INSERT INTO seed.run(namespace, plan_hash, plan, status, execution_version, attempt_id) VALUES ($1, $2, $3::jsonb, 'running', 2, $4)",
            namespace,
            hash,
            JSON.stringify(seedJson(plan)),
            attemptId
        );
    }

    async resume(namespace: string, attemptId: string): Promise<void> {
        const count = await this.database.queryClient.$executeRawUnsafe(
            "UPDATE seed.run SET attempt_id = $2, status = 'running', completed_at = NULL WHERE namespace = $1 AND execution_version = 2 AND status <> 'completed'",
            namespace,
            attemptId
        );
        if (count !== 1) throw new Error('This seed run cannot be resumed');
    }

    /** Held in the same transaction as business writes: a stale attempt cannot add receipts. */
    async guard(namespace: string, attemptId: string): Promise<void> {
        const rows = await this.database.queryClient.$queryRawUnsafe<{ namespace: string }[]>(
            "SELECT namespace FROM seed.run WHERE namespace = $1 AND attempt_id = $2 AND status = 'running' FOR UPDATE",
            namespace,
            attemptId
        );
        if (rows.length !== 1) throw new Error('Seed execution no longer owns this attempt');
    }

    async finish(
        namespace: string,
        attemptId: string,
        status: 'failed' | 'cancelled' | 'uncertain'
    ): Promise<void> {
        const count = await this.database.queryClient.$executeRawUnsafe(
            "UPDATE seed.run SET status = $3, completed_at = now() WHERE namespace = $1 AND attempt_id = $2 AND status = 'running'",
            namespace,
            attemptId,
            status
        );
        if (count !== 1) throw new Error('Unable to update the seed attempt outcome');
    }

    records(namespace: string, step: string): Promise<SeedRecordRow[]> {
        return this.database.queryClient.$queryRawUnsafe<SeedRecordRow[]>(
            'SELECT key, output, snapshot_hash, final_snapshot_hash FROM seed.record WHERE namespace = $1 AND step = $2 ORDER BY key',
            namespace,
            step
        );
    }

    async complete(namespace: string, attemptId: string, snapshots: SeedSnapshot[]): Promise<void> {
        await this.database.transaction.run(async () => {
            await this.guard(namespace, attemptId);
            const [{ count }] = await this.database.queryClient.$queryRawUnsafe<
                { count: bigint }[]
            >('SELECT count(*) AS count FROM seed.record WHERE namespace = $1', namespace);
            if (count !== BigInt(snapshots.length))
                throw new Error('Final snapshots do not cover every committed seed receipt');
            const updated = await this.database.queryClient.$executeRawUnsafe(
                'UPDATE seed.record AS r SET final_snapshot_hash = s.hash FROM jsonb_to_recordset($2::jsonb) AS s(step text, key text, hash text) WHERE r.namespace = $1 AND r.step = s.step AND r.key = s.key',
                namespace,
                JSON.stringify(snapshots)
            );
            if (updated !== snapshots.length) throw new Error('Incomplete seed snapshot sealing');
            await this.database.queryClient.$executeRawUnsafe(
                "UPDATE seed.run SET status = 'completed', completed_at = now() WHERE namespace = $1 AND attempt_id = $2",
                namespace,
                attemptId
            );
        });
    }

    async operation(namespace: string, step: string, key: string): Promise<SeedOperationRow> {
        await this.database.queryClient.$executeRawUnsafe(
            'INSERT INTO seed.operation(namespace, step, key, idempotency_key) VALUES ($1, $2, $3, $4::uuid) ON CONFLICT DO NOTHING',
            namespace,
            step,
            key,
            randomUUID()
        );
        const [row] = await this.database.queryClient.$queryRawUnsafe<SeedOperationRow[]>(
            'SELECT idempotency_key, checkpoint FROM seed.operation WHERE namespace = $1 AND step = $2 AND key = $3',
            namespace,
            step,
            key
        );
        return row;
    }

    async checkpoint(namespace: string, step: string, key: string, value: unknown): Promise<void> {
        const count = await this.database.queryClient.$executeRawUnsafe(
            'UPDATE seed.operation SET checkpoint = $4::jsonb WHERE namespace = $1 AND step = $2 AND key = $3',
            namespace,
            step,
            key,
            JSON.stringify(seedJson(value))
        );
        if (count !== 1) throw new Error('Unable to save the external seed operation checkpoint');
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
