import { bootstrapWorker } from './bootstrap/worker.js';
import { serializeError } from './platform/error/error.diagnostic.js';

bootstrapWorker().catch((error: unknown) => {
    // eslint-disable-next-line no-console -- Last-resort bootstrap diagnostic before logger initialization.
    console.error('Worker bootstrap failed:', serializeError(error));
    process.exit(1);
});
