import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    createPrismaProcessEnvironment,
    loadPrismaEnvironment,
    parsePrismaCommand,
    redactDatabaseUrl,
} from '../../scripts/prisma-environment.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(testDirectory, '../fixtures/prisma/valid.env');

describe('Prisma CLI environment', () => {
    it('removes a named environment selector before forwarding Prisma arguments', () => {
        expect(parsePrismaCommand(['migrate', 'status', '--env', 'test'])).toEqual({
            prismaArguments: ['migrate', 'status'],
            source: { kind: 'profile', name: 'test' },
        });
    });

    it('accepts inline selectors and explicit env files', () => {
        expect(parsePrismaCommand(['migrate', 'status', '--env=production'])).toEqual({
            prismaArguments: ['migrate', 'status'],
            source: { kind: 'profile', name: 'production' },
        });

        expect(parsePrismaCommand(['validate', `--env-file=${fixturePath}`])).toEqual({
            prismaArguments: ['validate'],
            source: { kind: 'file', path: fixturePath },
        });
    });

    it('loads only the two variables Prisma CLI needs', () => {
        const environment = loadPrismaEnvironment({ kind: 'file', path: fixturePath });

        expect(environment.values).toEqual({
            DATABASE_URL:
                'postgresql://cli_user:cli_password@127.0.0.1:5432/talosark?schema=public',
            SHADOW_DATABASE_URL:
                'postgresql://cli_user:shadow_password@127.0.0.1:5432/talosark_shadow?schema=public',
        });
        expect(process.env.PRISMA_CLI_FIXTURE_IGNORED).toBeUndefined();
    });

    it('overrides inherited database URLs with the selected environment', () => {
        const environment = loadPrismaEnvironment({ kind: 'file', path: fixturePath });
        const childEnvironment = createPrismaProcessEnvironment(
            {
                DATABASE_URL: 'postgresql://inherited:password@localhost:5432/inherited',
                SHADOW_DATABASE_URL:
                    'postgresql://inherited:password@localhost:5432/inherited_shadow',
            },
            environment.values
        );

        expect(childEnvironment.DATABASE_URL).toBe(environment.values.DATABASE_URL);
        expect(childEnvironment.SHADOW_DATABASE_URL).toBe(environment.values.SHADOW_DATABASE_URL);
    });

    it('rejects an ambiguous or incomplete environment selector', () => {
        expect(() => parsePrismaCommand(['migrate', 'status', '--env'])).toThrow(
            'requires a value'
        );
        expect(() =>
            parsePrismaCommand(['migrate', 'status', '--env', 'test', '--env-file', fixturePath])
        ).toThrow('only one environment selector');
    });

    it('redacts database passwords in the startup log', () => {
        expect(
            redactDatabaseUrl(
                'postgresql://cli_user:cli_password@127.0.0.1:5432/talosark?schema=public'
            )
        ).toBe('postgresql://cli_user:***@127.0.0.1:5432/talosark?schema=public');
    });
});
