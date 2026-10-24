import type { Client } from 'pg';
import type { SeedDatabaseCheck } from '../definition/database.js';

export class SeedReadinessError extends Error {
    constructor(readonly missing: readonly SeedDatabaseCheck[]) {
        super(
            'Database prerequisites are missing or disabled:\n' +
                missing
                    .map(({ requirement, usedBy }) => {
                        const name =
                            requirement.type === 'extension'
                                ? requirement.name
                                : requirement.type === 'function'
                                  ? requirement.signature
                                  : requirement.type === 'table'
                                    ? `${requirement.schema}.${requirement.name}`
                                    : `${requirement.schema}.${requirement.table}.${requirement.name}`;
                        const hints = [...new Set(usedBy.map((item) => item.hint))];
                        return `- ${requirement.type} ${name} (steps: ${usedBy.map((item) => item.step).join(', ')}). ${hints.join(' ')}`;
                    })
                    .join('\n')
        );
    }
}

/** Only catalog facts are inspected. No provisioning or business providers are invoked. */
export async function checkDatabaseReadiness(
    client: Pick<Client, 'query'>,
    checks: readonly SeedDatabaseCheck[]
): Promise<void> {
    if (!checks.length) return;
    const { rows } = await client.query<{ index: number; present: boolean }>(
        `SELECT r.index, CASE r.type
            WHEN 'table' THEN EXISTS (
                SELECT 1 FROM pg_class c
                WHERE c.oid = to_regclass(format('%I.%I', r.schema, r.name))
                  AND c.relkind IN ('r', 'p'))
            WHEN 'extension' THEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = r.name)
            WHEN 'constraint' THEN EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = to_regclass(format('%I.%I', r.schema, r."table"))
                  AND conname = r.name AND convalidated)
            WHEN 'trigger' THEN EXISTS (
                SELECT 1 FROM pg_trigger
                WHERE tgrelid = to_regclass(format('%I.%I', r.schema, r."table"))
                  AND tgname = r.name AND tgenabled IN ('O', 'A'))
            WHEN 'function' THEN to_regprocedure(r.signature) IS NOT NULL
            ELSE false END AS present
        FROM jsonb_to_recordset($1::jsonb)
            AS r(index int, type text, schema text, name text, "table" text, signature text)
        ORDER BY r.index`,
        [JSON.stringify(checks.map(({ requirement }, index) => ({ ...requirement, index })))]
    );
    const present = new Set(rows.filter((row) => row.present).map((row) => row.index));
    const missing = checks.filter((_, index) => !present.has(index));
    if (missing.length) throw new SeedReadinessError(missing);
}
