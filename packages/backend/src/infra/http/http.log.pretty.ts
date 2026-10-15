import type { PrettyAdapterMap } from '@/platform/observability/logger/pretty/pretty.adapter.js';

export const moduleUrl = import.meta.url;

export default {
    'http.outbound.completed': (record) => {
        if (
            typeof record.upstream !== 'string' ||
            typeof record.operation !== 'string' ||
            typeof record.outcome !== 'string' ||
            typeof record.durationMs !== 'number'
        )
            return undefined;
        const result =
            record.outcome === 'success' ? (record.upstreamStatus ?? 'success') : record.outcome;
        return `${record.upstream} · ${record.operation} → ${result} · ${record.durationMs}ms`;
    },
} satisfies PrettyAdapterMap;
