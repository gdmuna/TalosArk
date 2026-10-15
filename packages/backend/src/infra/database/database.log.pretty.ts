import {
    logObject,
    type PrettyAdapter,
    type PrettyAdapterMap,
} from '@/platform/observability/logger/pretty/pretty.adapter.js';

const query =
    (label: string): PrettyAdapter =>
    (record) => {
        const database = logObject(record.database);
        if (typeof database?.duration !== 'number') return undefined;
        return `${label} · ${database.duration}ms`;
    };

export const moduleUrl = import.meta.url;

export default {
    'database.connected': () => 'Database connected',
    'database.disconnected': () => 'Database disconnected',
    'database.query.completed': query('Query completed'),
    'database.query.slow': query('Slow query'),
    'database.query.critical': query('Critical slow query'),
} satisfies PrettyAdapterMap;
