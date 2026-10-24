export interface Page<T, Cursor extends string | number> {
    items: readonly T[];
    nextCursor: Cursor | null;
    total?: number;
}

export interface PageOptions {
    limit?: number;
    signal?: AbortSignal;
}

export function createPagination<T, Cursor extends string | number>(options: {
    first: Cursor;
    load: (
        cursor: Cursor,
        options: Required<Pick<PageOptions, 'limit'>> & Pick<PageOptions, 'signal'>
    ) => Promise<Page<T, Cursor>>;
}) {
    async function page(cursor: Cursor = options.first, input: PageOptions = {}) {
        const limit = input.limit ?? 20;
        if (!Number.isSafeInteger(limit) || limit <= 0)
            throw new RangeError('Page limit must be a positive integer');
        input.signal?.throwIfAborted();
        const result = await options.load(cursor, { ...input, limit });
        input.signal?.throwIfAborted();
        return result;
    }

    async function* pages(input: PageOptions = {}): AsyncGenerator<Page<T, Cursor>> {
        let cursor: Cursor | null = options.first;
        const visited = new Set<Cursor>();
        while (cursor !== null) {
            if (visited.has(cursor)) throw new Error('Pagination cursor did not progress');
            visited.add(cursor);
            const result = await page(cursor, input);
            yield result;
            cursor = result.nextCursor;
        }
    }

    return { page, pages };
}
