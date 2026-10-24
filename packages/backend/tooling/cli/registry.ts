import type { ToolCommand } from './context.js';

export interface CommandRegistration {
    readonly path: readonly string[];
    readonly description: string;
    readonly sourceOnly?: boolean;
    load(): Promise<ToolCommand>;
}

export const commands: readonly CommandRegistration[] = [
    {
        path: ['prisma'],
        description: 'Native Prisma commands with explicit database environment',
        sourceOnly: true,
        load: () => loadCommand('../database/prisma.js'),
    },
    {
        path: ['seed'],
        description: 'Development/test dataset planning and execution',
        sourceOnly: true,
        load: () => loadCommand('../seed/cli/entry.js'),
    },
    {
        path: ['app'],
        description: 'Development API and explicitly configured built processes',
        sourceOnly: true,
        load: () => loadCommand('../app/command.js'),
    },
    {
        path: ['db'],
        description: 'Database initialization, native DDL and Prisma',
        sourceOnly: true,
        load: () => loadCommand('../database/command.js'),
    },
    {
        path: ['storage'],
        description: 'Object storage bucket and CORS maintenance',
        load: () => import('../storage/command.js'),
    },
    {
        path: ['account'],
        description: 'Account provisioning and administrator maintenance',
        load: () => import('../account/command.js'),
    },
    {
        path: ['task'],
        description: 'Trusted background task maintenance',
        load: () => import('../task/command.js'),
    },
    {
        path: ['openapi'],
        description: 'Export an OpenAPI snapshot from a running instance',
        load: () => import('../openapi/command.js'),
    },
    {
        path: ['test'],
        description: 'Run tests with an explicitly selected runtime environment',
        sourceOnly: true,
        load: () => loadCommand('../check/test.js'),
    },
    {
        path: ['build'],
        description: 'Build application, operational tools or seed runtime',
        sourceOnly: true,
        load: () => loadCommand('../build/command.js'),
    },
    {
        path: ['check'],
        description: 'Check application, tooling and seed TypeScript contracts',
        sourceOnly: true,
        load: () => loadCommand('../check/command.js'),
    },
    {
        path: ['env'],
        description: 'Encrypt or decrypt explicitly selected environment files',
        sourceOnly: true,
        load: () => loadCommand('../environment/command.js'),
    },
];

// Development commands are not part of the emitted operational artifact.
async function loadCommand(path: string): Promise<ToolCommand> {
    return import(path);
}
