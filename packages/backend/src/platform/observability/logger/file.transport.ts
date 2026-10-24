import { once } from 'node:events';
import { fstat, type Stats } from 'node:fs';
import pino from 'pino';
import type { ObservabilityConfig } from '@/config/observability.config.js';

export type FileTransportOptions = Omit<ObservabilityConfig['logging']['file'], 'level'>;

export default async function fileTransport(
    options: FileTransportOptions
): Promise<ReturnType<typeof pino.destination>> {
    const rolling = options.rotation !== 'none' || options.maxSizeMb > 0;
    const destination = rolling
        ? await (
              await import('pino-roll')
          ).default({
              file: options.path,
              mkdir: true,
              sync: false,
              ...(options.rotation === 'none'
                  ? {}
                  : {
                        frequency: options.rotation,
                        dateFormat: options.rotation === 'daily' ? 'yyyy-MM-dd' : 'yyyy-MM-dd-HH',
                    }),
              ...(options.maxSizeMb > 0 ? { size: options.maxSizeMb } : {}),
              limit: { count: options.retainCount, removeOtherLogFiles: true },
          })
        : pino.destination({ dest: options.path, mkdir: true, sync: false });
    // pino-roll returns before the asynchronous file open has completed.
    try {
        await once(destination, 'ready');
        // Windows can open a directory successfully and fail only on the first write.
        const { fd } = destination as typeof destination & { fd: number };
        const stat = await new Promise<Stats>((resolve, reject) =>
            fstat(fd, (error, stat) => (error ? reject(error) : resolve(stat)))
        );
        if (!stat.isFile()) throw new TypeError('Log file destination must be a regular file');
    } catch (error) {
        destination.destroy();
        throw error;
    }
    return destination;
}
