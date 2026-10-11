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
        const request =
            typeof record.requestId === 'string' ? ` · requestId=${record.requestId}` : '';
        return `${label} · ${database.duration}ms${request}`;
    };

export default {
    'database.connected': () => '数据库已连接',
    'database.disconnected': () => '数据库已断开',
    'database.query.completed': query('查询完成'),
    'database.query.slow': query('慢查询'),
    'database.query.critical': query('严重慢查询'),
} satisfies PrettyAdapterMap;
