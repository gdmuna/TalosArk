import {
    logObject,
    type PrettyAdapter,
    type PrettyAdapterMap,
} from '@/platform/observability/logger/pretty/pretty.adapter.js';

const request =
    (label?: string): PrettyAdapter =>
    (record) => {
        const http = logObject(record.http);
        if (
            typeof http?.method !== 'string' ||
            typeof http.url !== 'string' ||
            typeof http.status !== 'number' ||
            typeof http.duration !== 'number'
        )
            return undefined;
        return `${http.method} ${http.url} → ${http.status} · ${http.duration}ms${label ? ` · ${label}` : ''}`;
    };

export default {
    'http.request.completed': request(),
    'http.request.failed': request('请求失败'),
    'http.request.slow': request('慢请求'),
    'http.request.critical': request('严重慢请求'),
} satisfies PrettyAdapterMap;
