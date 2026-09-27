import { AccessKernel } from '@/core/access/access.kernel.js';

type Row = { id: string; userId: string };
type CursorPage = Extract<Awaited<ReturnType<AccessKernel['listUserSession']>>, { type: 'cursor' }>;

const records: Row[] = Array.from({ length: 10 }, (_, index) => ({
    id: String(index + 1).padStart(2, '0'),
    userId: 'user-1',
}));

function createKernel() {
    const prismaService = {
        session: {
            findMany: async (args: {
                where: { userId: string };
                orderBy: { id: 'asc' | 'desc' };
                cursor?: { id: string; userId: string };
                skip?: number;
                take: number;
            }) => {
                const { where, orderBy, cursor, skip = 0, take } = args;
                let rows = records.filter((row) => row.userId === where.userId);
                rows.sort((a, b) =>
                    orderBy.id === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
                );
                if (cursor) {
                    if (cursor.userId !== where.userId) return [];
                    const index = rows.findIndex((row) => row.id === cursor.id);
                    rows = rows.slice(index + skip);
                } else {
                    rows = rows.slice(skip);
                }
                return rows.slice(0, take);
            },
            count: async ({ where }: { where: { userId: string } }) =>
                records.filter((row) => row.userId === where.userId).length,
        },
        $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    };

    return Object.assign(Object.create(AccessKernel.prototype), { prismaService }) as AccessKernel;
}

function cursorPage(output: Awaited<ReturnType<AccessKernel['listUserSession']>>): CursorPage {
    if (output.type !== 'cursor') throw new Error('Expected cursor pagination');
    return output;
}

describe('AccessKernel.listUserSession', () => {
    it.each(['asc', 'desc'] as const)('moves forward and backward in %s order', async (order) => {
        const kernel = createKernel();
        const input = { type: 'cursor' as const, userId: 'user-1', order, pageSize: 3 };
        const first = cursorPage(await kernel.listUserSession({ ...input, direction: 'forward' }));
        if (!first.nextCursor) throw new Error('Expected next cursor');
        const second = cursorPage(
            await kernel.listUserSession({
                ...input,
                direction: 'forward',
                cursor: first.nextCursor,
            })
        );
        if (!second.prevCursor) throw new Error('Expected previous cursor');
        const previous = cursorPage(
            await kernel.listUserSession({
                ...input,
                direction: 'backward',
                cursor: second.prevCursor,
            })
        );

        expect(first.items.map((row) => row.id)).toEqual(
            order === 'asc' ? ['01', '02', '03'] : ['10', '09', '08']
        );
        expect(second.items.map((row) => row.id)).toEqual(
            order === 'asc' ? ['04', '05', '06'] : ['07', '06', '05']
        );
        expect(previous.items).toEqual(first.items);
        expect(first.hasPrevPage).toBe(false);
        expect(second.hasPrevPage).toBe(true);
        expect(previous.hasNextPage).toBe(true);
        expect(previous.nextCursor).toBe(first.nextCursor);
    });

    it('reports the last page and rejects backward navigation without a cursor', async () => {
        const kernel = createKernel();
        const last = cursorPage(
            await kernel.listUserSession({
                type: 'cursor',
                userId: 'user-1',
                order: 'asc',
                direction: 'forward',
                cursor: '09',
                pageSize: 3,
            })
        );

        expect(last.items.map((row) => row.id)).toEqual(['10']);
        expect(last.hasNextPage).toBe(false);
        expect(last.prevCursor).toBe('10');
        const previous = cursorPage(
            await kernel.listUserSession({
                type: 'cursor',
                userId: 'user-1',
                order: 'asc',
                direction: 'backward',
                cursor: '10',
                pageSize: 3,
            })
        );
        expect(previous.items.map((row) => row.id)).toEqual(['07', '08', '09']);
        expect(previous.hasNextPage).toBe(true);
        await expect(
            kernel.listUserSession({
                type: 'cursor',
                userId: 'user-1',
                order: 'asc',
                direction: 'backward',
                cursor: '',
                pageSize: 3,
            })
        ).rejects.toThrow(RangeError);
    });

    it('keeps numbered pagination separate from cursor pagination', async () => {
        const output = await createKernel().listUserSession({
            type: 'offset',
            userId: 'user-1',
            order: 'asc',
            page: 2,
            pageSize: 3,
        });

        expect(output.type).toBe('offset');
        expect(output.items.map((row) => row.id)).toEqual(['04', '05', '06']);
        if (output.type === 'offset') expect(output.totalPages).toBe(4);
    });
});
