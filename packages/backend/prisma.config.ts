import { defineConfig, env } from 'prisma/config';

/**
 * Prisma's declarative configuration only. The CLI wrapper in scripts/prisma.ts
 * selects and injects DATABASE_URL plus SHADOW_DATABASE_URL before Prisma loads
 * this file, so this config never reads backend runtime environment files.
 */
export default defineConfig({
    schema: 'prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: env('DATABASE_URL'),
        shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
    },
});
