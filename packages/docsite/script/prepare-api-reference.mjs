import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// External documentation deployments do not publish the local Scalar viewer.
const destination = new URL('../docs/public/api-reference/', import.meta.url);
if (!/^https?:\/\//.test(process.env.VITE_API_REFERENCE_URL ?? '')) {
    const source = new URL('../api-reference/', import.meta.url);
    let document;
    try {
        document = JSON.parse(readFileSync(new URL('openapi.json', source), 'utf8'));
    } catch (error) {
        throw new Error(
            'Generate OpenAPI first: pnpm --filter @talos-ark/backend docs:gen-openapi',
            {
                cause: error,
            }
        );
    }
    if (
        !document ||
        typeof document.openapi !== 'string' ||
        !document.openapi.startsWith('3.') ||
        typeof document.info?.title !== 'string' ||
        typeof document.info?.version !== 'string' ||
        !document.paths ||
        typeof document.paths !== 'object' ||
        Array.isArray(document.paths)
    ) {
        throw new Error('API reference requires an OpenAPI 3 document');
    }
    mkdirSync(destination, { recursive: true });
    for (const file of ['index.html', 'openapi.json']) {
        copyFileSync(new URL(file, source), new URL(file, destination));
    }
    console.log(`API reference prepared in ${fileURLToPath(destination)}`);
} else {
    for (const file of ['index.html', 'openapi.json']) {
        rmSync(new URL(file, destination), { force: true });
    }
}
