import { once } from 'node:events';
import build from 'pino-abstract-transport';
import pino from 'pino';
import type { PrettyAdapter, PrettyAdapterMap, PrettyLog } from './pretty/pretty.adapter.js';
import { createExtensionIndex, type ExtensionEntry } from '../../extensions/index.js';
import type { PrettyModuleReference } from './logger.contribution.js';
import type { ObservabilityConfig } from '@/config/observability.config.js';

export interface OutputTransportOptions {
    settings: ObservabilityConfig['logging'];
    colorize: boolean;
    adapters: readonly PrettyModuleReference[];
}

type Destination = ReturnType<typeof pino.destination>;
type OutputTransport = ReturnType<typeof build> & {
    flush(callback: (error?: Error) => void): void;
};
type LogFrame = { record: PrettyLog & { level: number }; line: string; sequence: number };

export default async function outputTransport(
    options: OutputTransportOptions
): Promise<OutputTransport> {
    const { settings } = options;
    const hasConsole = settings.output !== 'file';
    const hasFile = settings.output !== 'console';
    const usePretty = hasConsole && settings.console.format === 'pretty';
    const entries: ExtensionEntry<string, PrettyAdapter>[] = [];
    const events = new Set<string>();
    for (const reference of usePretty ? options.adapters : []) {
        // URLs originate in already-registered trusted modules, never in a log record.
        const { default: registered } = (await import(reference.moduleUrl)) as {
            default: PrettyAdapterMap;
        };
        for (const [event, adapter] of Object.entries(registered)) {
            if (events.has(event)) throw new Error(`Duplicate pretty event: ${event}`);
            events.add(event);
            entries.push({
                key: event,
                value: adapter,
                source: reference.source,
            });
        }
    }
    const adapters = createExtensionIndex(entries);
    const render = usePretty
        ? (await import('./pretty/pretty.renderer.js')).createPrettyRenderer(
              { get: (event) => adapters.find(event) },
              options.colorize
          )
        : undefined;
    const outputs: { destination: Destination; level: number; pretty: boolean }[] = [];
    try {
        if (hasConsole) {
            const destination = pino.destination({ dest: 1, sync: false });
            outputs.push({
                destination,
                level: pino.levels.values[settings.console.level],
                pretty: usePretty,
            });
            await once(destination, 'ready');
        }
        if (hasFile) {
            outputs.push({
                destination: await (await import('./file.transport.js')).default(settings.file),
                level: pino.levels.values[settings.file.level],
                pretty: false,
            });
        }
    } catch (error) {
        for (const { destination } of outputs) destination.destroy();
        throw error;
    }

    let accepted = 0;
    let processed = 0;
    const waiting = new Set<{ sequence: number; resolve(): void; reject(error: Error): void }>();
    const transport = build(
        async (source) => {
            for await (const frame of source) {
                const { record, line, sequence } = frame as LogFrame;
                for (const { destination, level, pretty: formatPretty } of outputs) {
                    if (record.level < level) continue;
                    const text = formatPretty && render ? render(record) : `${line}\n`;
                    if (!destination.write(text)) await once(destination, 'drain');
                }
                processed = sequence;
                for (const waiter of waiting) {
                    if (waiter.sequence <= processed) {
                        waiting.delete(waiter);
                        waiter.resolve();
                    }
                }
            }
        },
        {
            metadata: false,
            parseLine(line: string) {
                return { record: JSON.parse(line), line, sequence: ++accepted } satisfies LogFrame;
            },
            async close(error) {
                for (const waiter of waiting)
                    waiter.reject(error ?? new Error('Log output closed'));
                waiting.clear();
                if (error) {
                    for (const { destination } of outputs) destination.destroy();
                    throw error;
                }
                await Promise.all(
                    outputs.map(async ({ destination }) => {
                        const closed = once(destination, 'close');
                        destination.end();
                        await closed;
                    })
                );
            },
        }
    ) as OutputTransport;
    // thread-stream 4 delegates flush to this method. The write barrier first
    // drains parser buffers; the sequence barrier then waits for async rendering.
    transport.flush = (callback) => {
        transport.write('', (error?: Error | null) => {
            if (error) return callback(error);
            const drained =
                accepted <= processed
                    ? Promise.resolve()
                    : new Promise<void>((resolve, reject) =>
                          waiting.add({ sequence: accepted, resolve, reject })
                      );
            void drained
                .then(() =>
                    Promise.all(
                        outputs.map(
                            ({ destination }) =>
                                new Promise<void>((resolve, reject) =>
                                    destination.flush((error) =>
                                        error ? reject(error) : resolve()
                                    )
                                )
                        )
                    )
                )
                .then(() => callback(), callback);
        });
    };
    for (const { destination } of outputs)
        destination.on('error', (error) => transport.destroy(error));
    return transport;
}
