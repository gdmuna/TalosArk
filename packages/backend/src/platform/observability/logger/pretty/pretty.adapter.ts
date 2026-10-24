export type PrettyLog = Readonly<Record<string, unknown>>;
export type PrettyAdapter = (record: PrettyLog) => string | undefined;
export type PrettyAdapterMap = Readonly<Record<string, PrettyAdapter>>;

export function logObject(value: unknown): PrettyLog | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as PrettyLog)
        : undefined;
}
