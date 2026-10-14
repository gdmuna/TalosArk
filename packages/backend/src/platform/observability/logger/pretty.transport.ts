import { once } from 'node:events';
import { basename } from 'node:path';
import build from 'pino-abstract-transport';
import pino from 'pino';
import pretty from 'pino-pretty';
import type { PrettyAdapter, PrettyAdapterMap } from './pretty/pretty.adapter.js';
import { createPrettyRenderer } from './pretty/pretty.renderer.js';
import { createExtensionIndex, type ExtensionEntry } from '../../extensions/index.js';

export interface PrettyTransportOptions {
    colorize?: boolean;
    destination?: string | number;
    adapterPaths?: readonly string[];
}

export default async function prettyTransport(options: PrettyTransportOptions = {}) {
    const entries: ExtensionEntry<string, PrettyAdapter>[] = [];
    const events = new Set<string>();
    for (const path of options.adapterPaths ?? []) {
        // Paths come only from the trusted composition root, never from a log record.
        const { default: registered } = (await import(path)) as { default: PrettyAdapterMap };
        for (const [event, adapter] of Object.entries(registered)) {
            if (events.has(event)) throw new Error(`Duplicate pretty event: ${event}`);
            events.add(event);
            entries.push({
                key: event,
                value: adapter,
                source: {
                    kind: 'explicit',
                    owner: basename(new URL(path, import.meta.url).pathname),
                },
            });
        }
    }
    const adapters = createExtensionIndex(entries);
    const render = createPrettyRenderer(
        { get: (event) => adapters.find(event) },
        options.colorize ?? pretty.isColorSupported
    );
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
