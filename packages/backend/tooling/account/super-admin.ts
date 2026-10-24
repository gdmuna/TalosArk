import { Option } from 'commander';
import { Pool } from 'pg';
import { z } from 'zod';
import { createCommand, type CliContext } from '../cli/context.js';
import { choosePrismaEnvironment, loadPrismaEnvironment } from '../database/environment.js';

export async function run(args: string[], context: CliContext): Promise<void> {
    const command = createCommand('tool account super-admin')
        .argument('[action]', 'grant | revoke')
        .addOption(new Option('--env <profile>', 'Prisma database profile').conflicts('envFile'))
        .option('--env-file <path>', 'Explicit Prisma database environment file')
        .option('--user-id <uuid>', 'Existing local user ID')
        .option('--username <name>', 'Confirm the case-sensitive account username')
        .addOption(new Option('--grant', 'Compatibility alias for grant').conflicts('revoke'))
        .addOption(new Option('--revoke', 'Compatibility alias for revoke').conflicts('grant'));
    command.parse(args, { from: 'user' });
    const options = command.opts();
    if (command.args[0] !== undefined && (options.grant || options.revoke))
        throw new Error('Choose an action or its compatibility flag, not both.');
    const action = await context.input.choose({
        value: command.args[0] ?? (options.grant ? 'grant' : options.revoke ? 'revoke' : undefined),
        flag: '<action>',
        example: 'pnpm account super-admin grant',
        message: 'Administrator operation:',
        choices: ['grant', 'revoke'].map((value) => ({ name: value, value })),
    });
    const userId = await context.input.text({
        value: options.userId,
        flag: '--user-id',
        message: 'Existing local user ID:',
        example: '--user-id <uuid>',
        parse: (value) => z.uuid().parse(value),
    });
    const username = await context.input.text({
        value: options.username,
        flag: '--username',
        message: 'Confirm the case-sensitive username:',
        example: '--username ExampleUser',
    });
    const source = await choosePrismaEnvironment(
        options.env !== undefined
            ? { kind: 'profile', name: options.env }
            : options.envFile !== undefined
              ? { kind: 'file', path: options.envFile }
              : undefined,
        context.input
    );
    const environment = loadPrismaEnvironment(source);
    const pool = new Pool({ connectionString: environment.values.DATABASE_URL });
    try {
        const result = await pool.query<{ id: string; username: string; isSuperAdmin: boolean }>(
            `UPDATE "User" SET "isSuperAdmin" = $1, "updatedAt" = NOW()
             WHERE id = $2::uuid AND username = $3 RETURNING id, username, "isSuperAdmin"`,
            [action === 'grant', userId, username]
        );
        if (result.rowCount !== 1) throw new Error('account-not-found');
        console.info(JSON.stringify({ environment: source, ...result.rows[0] }));
    } catch (cause) {
        throw new Error(
            'Super administrator update failed; verify schema, environment and account identity.',
            { cause }
        );
    } finally {
        await pool.end();
    }
}
