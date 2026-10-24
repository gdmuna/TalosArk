import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import type { SeedDatabaseCheck } from '../definition/database.js';
import { checkDatabaseReadiness } from './readiness.js';
import type { SeedRunResult } from './result.js';
import type { SeedRunRow } from './store.js';

interface Identity {
    database_name: string;
    role_name: string;
    recovery: boolean;
}

/** Holds a dedicated session lock for the entire run; no business transaction stays open. */
export class SeedTarget {
    private constructor(readonly client: Client) {}

    static async open(url: string, expectedDatabase: string): Promise<SeedTarget> {
        const client = new Client({
            connectionString: url,
            application_name: 'talosark-seed',
            connectionTimeoutMillis: 10000,
            query_timeout: 10000,
        });
        try {
            await client.connect();
            const {
                rows: [identity],
            } = await client.query<Identity>(
                'SELECT current_database() AS database_name, current_user AS role_name, pg_is_in_recovery() AS recovery'
            );
            if (identity.database_name !== expectedDatabase)
                throw new Error(
                    `Connected database ${identity.database_name} does not match --database ${expectedDatabase}`
                );
            if (identity.recovery)
                throw new Error(`Connected database ${identity.database_name} is a read replica`);
            const {
                rows: [lock],
            } = await client.query<{ locked: boolean }>(
                "SELECT pg_try_advisory_lock(hashtextextended('talosark.seed', 0)) AS locked"
            );
            if (!lock.locked)
                throw new Error('Another seed command is already using this database');
            console.info(
                `[seed] Connected database: ${identity.database_name}; role: ${identity.role_name}`
            );
            return new SeedTarget(client);
        } catch (error) {
            await client.end().catch(() => {});
            throw error;
        }
    }

    async initialize(schemaPath: string): Promise<void> {
        await this.client.query('BEGIN');
        try {
            await this.client.query(await readFile(schemaPath, 'utf8'));
            await this.client.query('COMMIT');
        } catch (error) {
            await this.client
                .query('ROLLBACK')
                .catch(() =>
                    console.error(
                        '[seed] Metadata rollback acknowledgement failed; inspect the initialization outcome'
                    )
                );
            throw error;
        }
    }

    private async requireMetadata(): Promise<void> {
        const {
            rows: [metadata],
        } = await this.client.query<{ present: boolean }>(
            "SELECT to_regclass('seed.run') IS NOT NULL AND to_regclass('seed.record') IS NOT NULL AND to_regclass('seed.operation') IS NOT NULL AND (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'seed' AND table_name = 'run' AND column_name IN ('execution_version', 'attempt_id', 'report')) = 3 AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'seed' AND table_name = 'record' AND column_name = 'final_snapshot_hash') AS present"
        );
        if (!metadata.present)
            throw new Error(
                'Seed metadata is missing or outdated; run db:seed init with the same environment and --database to create/upgrade tool-owned metadata. Business tables are not changed.'
            );
    }

    async inspect(namespace: string) {
        await this.requireMetadata();
        const {
            rows: [run],
        } = await this.client.query<SeedRunRow>(
            "SELECT status, plan_hash, execution_version, attempt_id, report, (plan->>'formatVersion')::int AS format_version FROM seed.run WHERE namespace = $1",
            [namespace]
        );
        if (!run) throw new Error('No run exists in this namespace');
        const { rows: records } = await this.client.query<{
            step: string;
            count: string;
            unsealed: string;
        }>(
            'SELECT step, count(*)::text AS count, count(*) FILTER (WHERE final_snapshot_hash IS NULL)::text AS unsealed FROM seed.record WHERE namespace = $1 GROUP BY step ORDER BY step',
            [namespace]
        );
        const { rows: operations } = await this.client.query<{
            step: string;
            key: string;
            receipted: boolean;
        }>(
            'SELECT o.step, o.key, r.key IS NOT NULL AS receipted FROM seed.operation o LEFT JOIN seed.record r USING (namespace, step, key) WHERE o.namespace = $1 ORDER BY o.step, o.key',
            [namespace]
        );
        return { namespace, run, records, operations };
    }

    async saveReport(result: SeedRunResult): Promise<void> {
        const saved = await this.client.query(
            'UPDATE seed.run SET report = $3::jsonb WHERE namespace = $1 AND attempt_id = $2',
            [result.namespace, result.attemptId, JSON.stringify(result)]
        );
        if (saved.rowCount !== 1) throw new Error('Unable to save the seed execution report');
    }

    async preflight(checks: readonly SeedDatabaseCheck[]): Promise<void> {
        await this.requireMetadata();
        await checkDatabaseReadiness(this.client, checks);
    }

    close(): Promise<void> {
        return this.client.end();
    }
}
