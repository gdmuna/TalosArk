/** Bound traversal before Zod or Socket.IO recursively inspects untrusted JSON. */
export function assertWsJson(value: unknown, maxBytes: number): void {
    const stack: { value: unknown; depth: number; exit?: boolean }[] = [{ value, depth: 0 }];
    const seen = new WeakSet<object>();
    let nodes = 0;
    while (stack.length) {
        const current = stack.pop();
        if (!current) break;
        if (current.exit) {
            seen.delete(current.value as object);
            continue;
        }
        if (++nodes > 8192 || current.depth > 24)
            throw new RangeError('WebSocket JSON complexity exceeded');
        const item = current.value;
        if (
            item === null ||
            item === undefined ||
            typeof item === 'boolean' ||
            typeof item === 'string'
        )
            continue;
        if (typeof item === 'number' && Number.isFinite(item)) continue;
        if (typeof item !== 'object' || seen.has(item))
            throw new TypeError('Expected acyclic JSON data');
        const prototype = Object.getPrototypeOf(item);
        if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null)
            throw new TypeError('Binary and custom WebSocket values are not supported');
        seen.add(item);
        stack.push({ value: item, depth: current.depth, exit: true });
        const values = Object.values(item);
        if (values.length + stack.length + nodes > 8192)
            throw new RangeError('WebSocket JSON complexity exceeded');
        for (const child of values) stack.push({ value: child, depth: current.depth + 1 });
    }
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > maxBytes)
        throw new RangeError('WebSocket JSON size exceeded');
}
