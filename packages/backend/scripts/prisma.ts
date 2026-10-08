import select from '@inquirer/select';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    createPrismaProcessEnvironment,
    getPrismaWrapperHelp,
    listPrismaEnvironments,
    loadPrismaEnvironment,
    parsePrismaCommand,
    redactDatabaseUrl,
    type PrismaEnvironment,
    type PrismaEnvironmentSource,
} from './prisma-environment.js';

/**
 * Prisma CLI entrypoint.
 *
 *   pnpm prisma migrate status --env test
 *   pnpm prisma migrate status --env=production
 *   pnpm prisma migrate status --env-file ./ops/prisma/env/.env.staging
 */
const requireFromHere = createRequire(import.meta.url);

try {
    process.exitCode = await main();
} catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
        console.info('[prisma] Environment selection canceled; nothing was executed.');
        process.exitCode = 130;
    } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[prisma] ${message}`);
        process.exitCode = 1;
    }
}

async function main(): Promise<number> {
    const command = parsePrismaCommand(process.argv.slice(2));
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
    if (!command.initialize && informational && !command.source) {
        // Prisma loads its config even for help; never borrow a real target here.
        return runPrisma(command.prismaArguments, {
            DATABASE_URL: 'postgresql://unused:unused@prisma-help.invalid:1/unused',
            SHADOW_DATABASE_URL: 'postgresql://unused:unused@prisma-help.invalid:1/unused_shadow',
        });
    }

    const environment = loadPrismaEnvironment(await chooseEnvironment(command.source));
    displayEnvironment(environment);

    if (!command.initialize) return runPrisma(command.prismaArguments, environment.values);

    const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../prisma/ddl/init');
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

async function chooseEnvironment(
    source?: PrismaEnvironmentSource
): Promise<PrismaEnvironmentSource> {
    if (source) return source;
    if (process.env.CI || !process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error(
            'No database environment selected. Use --env <profile> or --env-file <path> in CI/non-interactive terminals.'
        );
    }

    const files = listPrismaEnvironments();
    if (!files.length) {
        throw new Error(
            'No Prisma environment files found. Copy ops/prisma/env/.env.example and configure the database URLs.'
        );
    }

    return select({
        message: 'Select the Prisma database environment:',
        choices: files.map(({ source: choice, filePath }) => ({
            name: relative(process.cwd(), filePath),
            value: choice,
            description:
                choice.kind === 'profile'
                    ? `Profile: ${choice.name}${choice.name.startsWith('prod') ? ' (production)' : ''}`
                    : 'Custom Prisma environment file',
        })),
        loop: false,
    });
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

function runPrisma(
    argumentsToForward: string[],
    values: PrismaEnvironment['values']
): Promise<number> {
    const prismaCliPath = requireFromHere.resolve('prisma/build/index.js');
    return new Promise((resolveExit, reject) => {
        const child = spawn(process.execPath, [prismaCliPath, ...argumentsToForward], {
            env: createPrismaProcessEnvironment(process.env, values),
            stdio: 'inherit',
        });
        const interrupt = () => child.kill('SIGINT');
        const terminate = () => child.kill('SIGTERM');
        const cleanup = () => {
            process.off('SIGINT', interrupt);
            process.off('SIGTERM', terminate);
        };
        process.on('SIGINT', interrupt);
        process.on('SIGTERM', terminate);
        child.once('error', (error) => {
            cleanup();
            reject(new Error(`Unable to start Prisma CLI: ${error.message}`, { cause: error }));
        });
        child.once('close', (code, signal) => {
            cleanup();
            resolveExit(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1));
        });
    });
}
