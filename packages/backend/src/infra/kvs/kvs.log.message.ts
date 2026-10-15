const connectionMessages: Readonly<Record<string, string>> = {
    ECONNREFUSED: 'connection refused',
    ECONNRESET: 'connection reset by peer',
    ETIMEDOUT: 'connection timed out',
    EPIPE: 'connection pipe closed',
    ENOTFOUND: 'host lookup failed',
    EAI_AGAIN: 'host lookup temporarily unavailable',
};

export const kvsConnectionMessage = (code: string): string | undefined =>
    Object.hasOwn(connectionMessages, code) ? connectionMessages[code] : undefined;
