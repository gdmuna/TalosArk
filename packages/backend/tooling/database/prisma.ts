import { readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { CliContext, ToolCommand } from '../cli/context.js';
import { InputResolver } from '../cli/input.js';
import { findBackendRoot } from '../cli/backend-root.js';
import { runNodeModule } from '../cli/process.js';

import {
    createPrismaProcessEnvironment,
    getPrismaWrapperHelp,
    choosePrismaEnvironment,
    loadPrismaEnvironment,
    parsePrismaCommand,
    redactDatabaseUrl,
    type PrismaEnvironment,
} from './environment.js';

/**
 * Prisma CLI entrypoint.
 *
 *   pnpm prisma migrate status --env test
 *   pnpm prisma migrate status --env=production
 *   pnpm prisma migrate status --env-file ./ops/prisma/env/.env.staging
 */
export async function run(args: string[], context: CliContext): Promise<void> {
    process.exitCode = await main(args, context.input);
}

export const prismaCommand: ToolCommand = { run };

async function main(args: string[], input: InputResolver): Promise<number> {
    const command = parsePrismaCommand(args);
    const argumentsBeforeSeparator = command.prismaArguments.slice(
        0,
        command.prismaArguments.includes('--')
            ? command.prismaArguments.indexOf('--')
            : command.prismaArguments.length
    );
    const requestsHelp = argumentsBeforeSeparator.some(
        (value) => value === '--help' || value === '-h'
    );

    if (
        (!command.initialize && !command.prismaArguments.length) ||
        (requestsHelp && (command.initialize || command.prismaArguments.length === 1))
    ) {
        console.info(getPrismaWrapperHelp());
        return 0;
    }

    if (command.initialize && command.prismaArguments.length) {
        throw new Error(
            'Database initialization accepts only --env or --env-file; no Prisma arguments.'
        );
    }

    const informational =
        requestsHelp ||
        argumentsBeforeSeparator.some((value) => value === '--version' || value === '-v');
    if (!command.initialize && informational) {
        // Prisma loads its config even for help; never borrow a real target here.
        return runPrisma(command.prismaArguments, {
            DATABASE_URL: 'postgresql://unused:unused@prisma-help.invalid:1/unused',
            SHADOW_DATABASE_URL: 'postgresql://unused:unused@prisma-help.invalid:1/unused_shadow',
        });
    }

    const environment = loadPrismaEnvironment(await choosePrismaEnvironment(command.source, input));
    displayEnvironment(environment);

    if (!command.initialize) return runPrisma(command.prismaArguments, environment.values);

    const directory = resolve(findBackendRoot(), 'prisma/ddl/init');
    const files = readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
        .map((entry) => entry.name)
        .sort();
    if (!files.length)
        throw new Error(`No database initialization SQL files found in ${directory}.`);

    for (const file of files) {
        console.info(`[prisma] Applying initialization SQL: ${file}`);
        const code = await runPrisma(
            ['db', 'execute', '--file', resolve(directory, file)],
            environment.values
        );
        if (code !== 0) return code;
    }
    console.info(`[prisma] Database initialization complete (${files.length} SQL file(s)).`);
    return 0;
}

function displayEnvironment(environment: PrismaEnvironment): void {
    const displayPath = relative(process.cwd(), environment.filePath) || '.';
    const sourceLabel =
        environment.source.kind === 'profile'
            ? `profile "${environment.source.name}"`
            : 'explicit env file';

    console.info(`[prisma] Using ${sourceLabel}: ${displayPath}`);
    console.info(
        `[prisma] Injected DATABASE_URL=${redactDatabaseUrl(environment.values.DATABASE_URL)}`
    );
    console.info(
        `[prisma] Injected SHADOW_DATABASE_URL=${redactDatabaseUrl(environment.values.SHADOW_DATABASE_URL)}`
    );
}

export function runPrisma(
    argumentsToForward: string[],
    values: PrismaEnvironment['values']
): Promise<number> {
    return runNodeModule(
        'prisma/build/index.js',
        argumentsToForward,
        createPrismaProcessEnvironment(process.env, values)
    );
}
