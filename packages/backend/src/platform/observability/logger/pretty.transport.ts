import { once } from 'node:events';
import build from 'pino-abstract-transport';
import pino from 'pino';
import pretty from 'pino-pretty';
import type { PrettyAdapter, PrettyAdapterMap } from './pretty/pretty.adapter.js';
import { createPrettyRenderer } from './pretty/pretty.renderer.js';

export interface PrettyTransportOptions {
    colorize?: boolean;
    destination?: string | number;
    adapterPaths?: readonly string[];
}

export default async function prettyTransport(options: PrettyTransportOptions = {}) {
    const adapters = new Map<string, PrettyAdapter>();
    for (const path of options.adapterPaths ?? []) {
        // Paths come only from the trusted composition root, never from a log record.
        const { default: registered } = (await import(path)) as { default: PrettyAdapterMap };
        for (const [event, adapter] of Object.entries(registered)) {
            if (adapters.has(event)) throw new Error(`Duplicate pretty event: ${event}`);
            adapters.set(event, adapter);
        }
    }
    const render = createPrettyRenderer(adapters, options.colorize ?? pretty.isColorSupported);
    const destination = pino.destination({ dest: options.destination ?? 1, sync: false });
    await once(destination, 'ready');
    const transport = build(
        async (source) => {
            for await (const record of source) {
                if (!destination.write(render(record))) await once(destination, 'drain');
            }
        },
        {
            async close(error) {
                if (error) {
                    destination.destroy();
                    throw error;
                }
                const closed = once(destination, 'close');
                destination.end();
                await closed;
            },
        }
    );
    destination.on('error', (error) => transport.destroy(error));
    return transport;
}
