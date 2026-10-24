import { resolve } from 'node:path';
import { createCommand, type CliContext } from '../cli/context.js';
import { findBackendRoot } from '../cli/backend-root.js';
import { exportOpenApi } from './export.js';

export async function run(args: string[], context: CliContext): Promise<void> {
    const command = createCommand('tool openapi')
        .argument('[action]', 'export')
        .option(
            '--url <url>',
            'Running backend base URL',
            process.env.BACKEND_URL || `http://localhost:${process.env.PORT || '3000'}`
        )
        .option(
            '--output <path>',
            'OpenAPI snapshot destination',
            resolve(findBackendRoot(), '../docsite/api-reference/openapi.json')
        );
    command.parse(args, { from: 'user' });
    await context.input.choose({
        value: command.args[0],
        flag: '<action>',
        message: 'OpenAPI operation:',
        example: 'pnpm tool openapi export',
        choices: [{ name: 'export', value: 'export' }],
    });
    const options = command.opts<{ url: string; output: string }>();
    const url = new URL(options.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('--url must be an HTTP(S) backend address without credentials.');
    await exportOpenApi(url.href, resolve(options.output));
}
