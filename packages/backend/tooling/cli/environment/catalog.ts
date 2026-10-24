import { existsSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { InputResolver } from '../input.js';

export type EnvironmentSource = { kind: 'profile'; name: string } | { kind: 'file'; path: string };
export interface EnvironmentCandidate {
    readonly source: EnvironmentSource;
    readonly files: string[];
    readonly label: string;
}
export interface EnvironmentCatalogOptions {
    readonly directory: string;
    readonly profiles: Readonly<Record<string, readonly string[]>>;
    readonly filesForProfile?: (name: string) => readonly string[];
}

export function createEnvironmentCatalog(options: EnvironmentCatalogOptions) {
    function resolveSource(source: EnvironmentSource): EnvironmentCandidate {
        let files: string[];
        if (source.kind === 'file') {
            if (!source.path.trim()) throw new Error('Environment file path must not be empty.');
            files = [resolve(source.path)];
        } else {
            if (
                !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(source.name) ||
                /(?:example|keys)$/.test(source.name)
            )
                throw new Error(`Invalid environment profile "${source.name}".`);
            files = (
                options.profiles[source.name] ??
                options.filesForProfile?.(source.name) ?? [`.env.${source.name}`]
            ).map((file) => resolve(options.directory, file));
        }
        for (const file of files)
            if (!existsSync(file) || !statSync(file).isFile())
                throw new Error(`Environment file was not found: ${file}`);
        return {
            source,
            files,
            label: source.kind === 'profile' ? source.name : relative(process.cwd(), files[0]),
        };
    }

    function list(): EnvironmentCandidate[] {
        if (!existsSync(options.directory)) return [];
        const byFile = new Map<string, string>(
            Object.entries(options.profiles).map(([name, files]) => [
                resolve(options.directory, files[0]),
                name,
            ])
        );
        return readdirSync(options.directory, { withFileTypes: true })
            .filter(
                (entry) =>
                    entry.isFile() &&
                    (entry.name === '.env' || entry.name.startsWith('.env.')) &&
                    !/(?:^|\.)(?:example|keys)$/.test(entry.name)
            )
            .sort((a, b) => a.name.localeCompare(b.name, 'en'))
            .map((entry) => {
                const path = resolve(options.directory, entry.name);
                const name = byFile.get(path);
                return resolveSource(
                    name
                        ? { kind: 'profile', name }
                        : entry.name === '.env'
                          ? { kind: 'file', path }
                          : { kind: 'profile', name: entry.name.slice(5) }
                );
            });
    }

    async function selectWithInput(
        input: InputResolver,
        source?: EnvironmentSource,
        filter?: (candidate: EnvironmentCandidate) => boolean
    ): Promise<EnvironmentCandidate> {
        if (source !== undefined) {
            const candidate = resolveSource(source);
            if (filter && !filter(candidate))
                throw new Error(
                    `Environment source is not valid for this command: ${candidate.label}`
                );
            return candidate;
        }
        const choices = list().filter((candidate) => !filter || filter(candidate));
        if (!choices.length) throw new Error(`No environment files found in ${options.directory}.`);
        return input.choose({
            flag: '--env or --env-file',
            example: '--env dev.local',
            message: 'Select the environment:',
            choices: choices.map((candidate) => ({
                name: candidate.label,
                value: candidate,
                description: candidate.files
                    .map((file) => relative(process.cwd(), file))
                    .join(' → '),
            })),
        });
    }
    async function selectSource(
        source?: EnvironmentSource,
        filter?: (candidate: EnvironmentCandidate) => boolean
    ): Promise<EnvironmentCandidate> {
        return selectWithInput(new InputResolver(), source, filter);
    }
    return { list, select: selectSource, selectWithInput, resolve: resolveSource };
}
