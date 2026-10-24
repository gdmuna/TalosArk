import { config } from '@dotenvx/dotenvx-ops';
import { Command, CommanderError } from 'commander';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { findBackendRoot } from '../cli/backend-root.js';
import { createEnvironmentCatalog } from '../cli/environment/catalog.js';
import { InputResolver } from '../cli/input.js';

const REQUIRED_PRISMA_ENVIRONMENT_KEYS = ['DATABASE_URL', 'SHADOW_DATABASE_URL'] as const;
const backendRoot = findBackendRoot();
const environmentDirectory = resolve(backendRoot, 'ops/prisma/env');

/**
 * Named profiles deliberately resolve only to Prisma CLI configuration files.
 * They never read the backend runtime `secrets/env` files.
 */
export const PRISMA_ENVIRONMENT_FILES = {
    dev: resolve(backendRoot, 'ops/prisma/env/.env.development'),
    test: resolve(backendRoot, 'ops/prisma/env/.env.test'),
    prod: resolve(backendRoot, 'ops/prisma/env/.env.production'),
    'dev.local': resolve(backendRoot, 'ops/prisma/env/.env.development.local'),
    'test.local': resolve(backendRoot, 'ops/prisma/env/.env.test.local'),
    'prod.local': resolve(backendRoot, 'ops/prisma/env/.env.production.local'),
} as const;

type PrismaEnvironmentName = keyof typeof PRISMA_ENVIRONMENT_FILES;
type PrismaEnvironmentKey = (typeof REQUIRED_PRISMA_ENVIRONMENT_KEYS)[number];

export type PrismaEnvironmentSource =
    { kind: 'profile'; name: string } | { kind: 'file'; path: string };

export interface PrismaCommand {
    prismaArguments: string[];
    source?: PrismaEnvironmentSource;
    initialize?: true;
}

export interface PrismaEnvironment {
    source: PrismaEnvironmentSource;
    filePath: string;
    values: Record<PrismaEnvironmentKey, string>;
}

const prismaEnvironmentCatalog = createEnvironmentCatalog({
    directory: environmentDirectory,
    profiles: Object.fromEntries(
        Object.entries(PRISMA_ENVIRONMENT_FILES).map(([name, filePath]) => [name, [filePath]])
    ),
});

export async function choosePrismaEnvironment(
    source?: PrismaEnvironmentSource,
    input = new InputResolver()
): Promise<PrismaEnvironmentSource> {
    if (source) {
        prismaEnvironmentCatalog.resolve(source);
        return source;
    }
    return (await prismaEnvironmentCatalog.selectWithInput(input)).source;
}

/**
 * Removes this wrapper's environment selector before Prisma receives its own
 * arguments. Prisma itself does not know about --env or --env-file.
 */
export function parsePrismaCommand(rawArguments: readonly string[]): PrismaCommand {
    const parser = createPrismaCommandParser();
    const separatorIndex = rawArguments.indexOf('--');
    const argumentsToParse =
        separatorIndex < 0 ? rawArguments : rawArguments.slice(0, separatorIndex);

    try {
        parser.parse([...argumentsToParse], { from: 'user' });
    } catch (error) {
        if (error instanceof CommanderError && error.code === 'commander.optionMissingArgument') {
            const option = error.message.includes('--env-file') ? '--env-file' : '--env';
            throw new Error(`Prisma CLI option ${option} requires a value.`, { cause: error });
        }
        throw error;
    }

    const options = parser.opts<{ env?: string; envFile?: string; init?: boolean }>();
    const source: PrismaEnvironmentSource | undefined = options.env
        ? { kind: 'profile', name: options.env }
        : options.envFile
          ? { kind: 'file', path: resolve(process.cwd(), options.envFile) }
          : undefined;

    return {
        prismaArguments: [
            ...parser.args,
            ...(separatorIndex < 0 ? [] : rawArguments.slice(separatorIndex)),
        ],
        source,
        ...(options.init ? { initialize: true } : {}),
    };
}

export function getPrismaWrapperHelp(): string {
    let help = '';
    createPrismaCommandParser()
        .configureOutput({ writeOut: (text) => (help += text) })
        .outputHelp();
    return help;
}

/** Discover files without loading their credentials before the user selects one. */
export function listPrismaEnvironments(): { source: PrismaEnvironmentSource; filePath: string }[] {
    return readdirSync(environmentDirectory, { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isFile() &&
                (entry.name === '.env' || entry.name.startsWith('.env.')) &&
                entry.name !== '.env.example' &&
                !entry.name.endsWith('.example')
        )
        .map((entry) => {
            const filePath = resolve(environmentDirectory, entry.name);
            const profile = Object.entries(PRISMA_ENVIRONMENT_FILES).find(
                ([, path]) => path === filePath
            );
            const source: PrismaEnvironmentSource = profile
                ? { kind: 'profile', name: profile[0] }
                : { kind: 'file', path: filePath };
            return { source, filePath };
        })
        .sort((left, right) => left.filePath.localeCompare(right.filePath, 'en'));
}

export function loadPrismaEnvironment(source: PrismaEnvironmentSource): PrismaEnvironment {
    const filePath = resolvePrismaEnvironmentFile(source);

    if (!existsSync(filePath)) {
        throw new Error(
            `Prisma environment file was not found: ${filePath}\n` +
                'Copy ops/prisma/env/.env.example and provide DATABASE_URL plus SHADOW_DATABASE_URL.'
        );
    }

    const parsed: Record<string, string> = {};

    try {
        const result = config({
            path: filePath,
            processEnv: parsed,
            override: true,
            quiet: true,
            strict: true,
        });

        if (result.error) throw result.error;
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Unable to load Prisma environment file ${filePath}: ${reason}`, {
            cause: error,
        });
    }

    const values = {} as Record<PrismaEnvironmentKey, string>;

    for (const key of REQUIRED_PRISMA_ENVIRONMENT_KEYS) {
        const value = parsed[key]?.trim();
        if (!value) {
            throw new Error(`Prisma environment file ${filePath} must define ${key}.`);
        }
        values[key] = value;
    }

    return { source, filePath, values };
}

/**
 * The selected file may contain comments or incidental variables, but Prisma
 * receives only its two connection strings. Selected values take precedence
 * over similarly named values inherited from the shell.
 */
export function createPrismaProcessEnvironment(
    baseEnvironment: NodeJS.ProcessEnv,
    values: PrismaEnvironment['values']
): NodeJS.ProcessEnv {
    return {
        ...baseEnvironment,
        DATABASE_URL: values.DATABASE_URL,
        SHADOW_DATABASE_URL: values.SHADOW_DATABASE_URL,
    };
}

export function redactDatabaseUrl(value: string): string {
    try {
        const url = new URL(value);
        const credentials = url.username ? `${url.username}${url.password ? ':***' : ''}@` : '';
        return `${url.protocol}//${credentials}${url.host}${url.pathname}`;
    } catch {
        return '<invalid URL; value redacted>';
    }
}

function createPrismaCommandParser(): Command {
    let selected = false;
    const selectSource = (value: string): string => {
        if (!value.trim()) throw new Error('Prisma environment selector requires a value.');
        if (selected) {
            throw new Error(
                'Prisma CLI accepts only one environment selector: --env or --env-file.'
            );
        }
        selected = true;
        return value;
    };

    return new Command('prisma')
        .description('Run Prisma with an explicitly selected database environment.')
        .usage('[wrapper options] <Prisma command...>')
        .helpOption(false)
        .allowUnknownOption()
        .allowExcessArguments()
        .exitOverride()
        .configureOutput({ writeErr: () => {} })
        .option(
            '--env <profile>',
            'Prisma environment profile, e.g. dev.local or staging',
            selectSource
        )
        .option('--env-file <path>', 'Explicit Prisma environment file', selectSource)
        .option('--init', 'Apply database initialization SQL only (also available as pnpm db:init)')
        .addHelpText(
            'after',
            '\nWithout a selector, an interactive terminal prompts for an environment file.\n' +
                'CI and non-interactive commands must supply --env or --env-file.\n' +
                'Prisma options are forwarded unchanged; -- ends wrapper option parsing.\n\n' +
                'Examples:\n' +
                '  pnpm db:push\n' +
                '  pnpm prisma --env dev.local db push\n' +
                '  pnpm prisma db push --env-file ./ops/prisma/env/.env.staging\n' +
                '  pnpm db:init --env dev.local\n'
        );
}

function resolvePrismaEnvironmentFile(source: PrismaEnvironmentSource): string {
    if (source.kind === 'file') return source.path;

    if (isPrismaEnvironmentName(source.name)) return PRISMA_ENVIRONMENT_FILES[source.name];

    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(source.name) || source.name.endsWith('.example')) {
        throw new Error(`Invalid Prisma environment profile "${source.name}".`);
    }
    return resolve(environmentDirectory, `.env.${source.name}`);
}

function isPrismaEnvironmentName(value: string): value is PrismaEnvironmentName {
    return Object.hasOwn(PRISMA_ENVIRONMENT_FILES, value);
}
