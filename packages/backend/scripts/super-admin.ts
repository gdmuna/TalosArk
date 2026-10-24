import { Command, Option } from 'commander';
import { Pool } from 'pg';
import { loadPrismaEnvironment } from './prisma-environment.js';

const command = new Command()
    .description('Grant or revoke system administrator access for one existing local account.')
    .requiredOption('--env <profile>', 'Explicit Prisma database environment')
    .requiredOption('--user-id <uuid>', 'Existing local user ID')
    .requiredOption('--username <name>', 'Confirm the case-sensitive account username')
    .addOption(new Option('--grant', 'Grant system administrator access').conflicts('revoke'))
    .addOption(new Option('--revoke', 'Revoke system administrator access').conflicts('grant'));
command.parse();
const options = command.opts<{
    env: string;
    userId: string;
    username: string;
    grant?: boolean;
    revoke?: boolean;
}>();

if (!options.grant && !options.revoke) command.error('Choose --grant or --revoke.');
const environment = loadPrismaEnvironment({ kind: 'profile', name: options.env });
const pool = new Pool({ connectionString: environment.values.DATABASE_URL });
try {
    const result = await pool.query<{ id: string; username: string; isSuperAdmin: boolean }>(
        `UPDATE "User" SET "isSuperAdmin" = $1, "updatedAt" = NOW()
         WHERE id = $2::uuid AND username = $3
         RETURNING id, username, "isSuperAdmin"`,
        [options.grant === true, options.userId, options.username]
    );
    if (result.rowCount !== 1) throw new Error('account-not-found');
    console.info(JSON.stringify({ environment: options.env, ...result.rows[0] }));
} catch {
    console.error(
        'Super administrator update failed; verify schema, environment and account identity.'
    );
    process.exitCode = 1;
} finally {
    await pool.end();
}
