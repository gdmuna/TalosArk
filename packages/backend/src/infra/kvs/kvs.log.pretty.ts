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
    'kvs.connected': () => 'KVS connected',
    'kvs.closed': () => 'KVS closed',
    'kvs.close.timeout': () => 'KVS close timed out; pending commands aborted',
    'kvs.connection.error': (record) => {
        const error = logObject(record.err);
        if (!error) return undefined;
        const codes = new Set<string>();
        collectCodes(error, codes);
        if (codes.size !== 1) return 'Valkey connection failed';
        const message: Record<string, string> = {
            ECONNREFUSED: 'Valkey connection refused',
            ECONNRESET: 'Valkey connection reset by peer',
            ETIMEDOUT: 'Valkey connection timed out',
            EPIPE: 'Valkey connection pipe closed',
            ENOTFOUND: 'Valkey host lookup failed',
            EAI_AGAIN: 'Valkey host lookup temporarily unavailable',
        };
        const code = [...codes][0];
        return code && Object.hasOwn(message, code) ? message[code] : 'Valkey connection failed';
    },
} satisfies PrettyAdapterMap;
