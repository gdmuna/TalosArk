import { runWithObservability } from './bootstrap/observability.js';
import { serializeError } from './platform/error/error.diagnostic.js';

runWithObservability('worker', async (runtime) => {
    const { bootstrapWorker } = await import('./bootstrap/worker.js');
    await bootstrapWorker(runtime);
}).catch((error: unknown) => {
    // eslint-disable-next-line no-console -- Last-resort bootstrap diagnostic before logger initialization.
    console.error('Worker bootstrap failed:', serializeError(error));
    process.exit(1);
});
