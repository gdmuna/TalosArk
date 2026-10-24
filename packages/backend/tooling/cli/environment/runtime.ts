import { config } from '@dotenvx/dotenvx-ops';
import { Option, type Command } from 'commander';
import { resolve } from 'node:path';
import { findBackendRoot } from '../backend-root.js';
import type { InputResolver } from '../input.js';
import { createEnvironmentCatalog, type EnvironmentSource } from './catalog.js';

export interface RuntimeEnvironmentOptions {
    env?: string;
    envFile?: string[];
    envProcess?: boolean;
}

export const RUNTIME_ENVIRONMENT_PROFILES = {
    dev: ['.env.development'],
    'dev.local': ['.env.development.local', '.env.development'],
    test: ['.env.test'],
    'test.local': ['.env.test.local', '.env.test'],
    prod: ['.env.production'],
    'prod.local': ['.env.production.local', '.env.production'],
} as const;

export const runtimeEnvironment = createEnvironmentCatalog({
    directory: resolve(findBackendRoot(), 'secrets/env'),
    profiles: RUNTIME_ENVIRONMENT_PROFILES,
    filesForProfile: (name) =>
        name.endsWith('.local') ? [`.env.${name}`, `.env.${name.slice(0, -6)}`] : [`.env.${name}`],
});

export function addRuntimeEnvironment(command: Command): Command {
    return command
        .addOption(
            new Option('--env <profile>', 'Runtime profile, such as dev.local').conflicts([
                'envFile',
                'envProcess',
            ])
        )
        .addOption(
            new Option('--env-file <path...>', 'Runtime files, highest priority first').conflicts([
                'env',
                'envProcess',
            ])
        )
        .addOption(
            new Option(
                '--env-process',
                'Explicitly use only the inherited process environment'
            ).conflicts(['env', 'envFile'])
        );
}

export async function selectRuntimeEnvironment(
    input: InputResolver,
    options: RuntimeEnvironmentOptions,
    filter?: (candidate: { source: EnvironmentSource; files: string[]; label: string }) => boolean
) {
    if (
        [
            options.env !== undefined,
            options.envFile !== undefined,
            options.envProcess === true,
        ].filter(Boolean).length > 1
    )
        throw new Error('Choose only one of --env, --env-file or --env-process.');
    if (options.envProcess) return { files: [] as string[], label: 'process environment' };
    if (options.envFile !== undefined) {
        if (!options.envFile.length) throw new Error('--env-file requires a file.');
        return {
            files: options.envFile.flatMap(
                (path) => runtimeEnvironment.resolve({ kind: 'file', path }).files
            ),
            label: 'explicit runtime files',
        };
    }
    const source: EnvironmentSource | undefined =
        options.env !== undefined ? { kind: 'profile', name: options.env } : undefined;
    return runtimeEnvironment.selectWithInput(input, source, filter);
}

export function loadRuntimeEnvironment(
    files: readonly string[],
    base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
    const values = { ...base };
    if (files.length) {
        const loaded = config({
            path: [...files],
            processEnv: values as Record<string, string>,
            quiet: true,
            strict: true,
        });
        if (loaded.error)
            throw new Error('Unable to load the selected runtime environment.', {
                cause: loaded.error,
            });
    }
    return values;
}

export function loadIsolatedEnvironment(files: readonly string[]): Record<string, string> {
    return loadRuntimeEnvironment(files, {}) as Record<string, string>;
}
