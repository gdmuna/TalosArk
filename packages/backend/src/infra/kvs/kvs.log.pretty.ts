import {
    logObject,
    type PrettyAdapterMap,
    type PrettyLog,
} from '@/platform/observability/logger/pretty/pretty.adapter.js';

function collectCodes(error: PrettyLog, codes: Set<string>, depth = 0): void {
    if (depth >= 8) return;
    const children = Array.isArray(error.errors)
        ? error.errors.flatMap((value) => {
              const child = logObject(value);
              return child ? [child] : [];
          })
        : [];
    const cause = logObject(error.cause);
    if (children.length) {
        for (const child of children) collectCodes(child, codes, depth + 1);
    } else if (cause) {
        collectCodes(cause, codes, depth + 1);
    } else if (typeof error.code === 'string') {
        codes.add(error.code);
    } else if (error.type === 'ConnectionTimeoutError') {
        codes.add('ETIMEDOUT');
    }
}

export default {
    'kvs.connected': () => 'KVS 已连接',
    'kvs.closed': () => 'KVS 已关闭',
    'kvs.close.timeout': () => 'KVS 关闭超时；待执行命令已中止',
    'kvs.connection.error': (record) => {
        const error = logObject(record.err);
        if (!error) return undefined;
        const codes = new Set<string>();
        collectCodes(error, codes);
        if (codes.size !== 1) return 'Valkey 连接失败';
        const message: Record<string, string> = {
            ECONNREFUSED: 'Valkey 连接被拒绝',
            ECONNRESET: 'Valkey 连接被对端重置',
            ETIMEDOUT: 'Valkey 连接超时',
            EPIPE: 'Valkey 连接管道已关闭',
            ENOTFOUND: 'Valkey 主机名解析失败',
            EAI_AGAIN: 'Valkey 主机名解析暂时不可用',
        };
        const code = [...codes][0];
        return code && Object.hasOwn(message, code) ? message[code] : 'Valkey 连接失败';
    },
} satisfies PrettyAdapterMap;
