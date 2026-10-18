import { createHash } from 'node:crypto';
import { z } from 'zod';
import { FacilityError } from '../../facility.error.js';
import { storageNodeIdSchema } from './storage-node.input.js';
import type {
    StorageNodeChildrenInput,
    StorageNodeDescendantsInput,
} from '../../public/facility-storage-topology.contract.js';

const cursorSchema = z.discriminatedUnion('order', [
    z.strictObject({
        version: z.literal(1),
        queryKey: z.string().regex(/^[0-9a-f]{64}$/),
        order: z.literal('children'),
        id: storageNodeIdSchema,
        sortOrder: z.number().int().min(-2_147_483_648).max(2_147_483_647),
    }),
    z.strictObject({
        version: z.literal(1),
        queryKey: z.string().regex(/^[0-9a-f]{64}$/),
        order: z.literal('descendants'),
        id: storageNodeIdSchema,
    }),
]);

export type StorageNodeCursor = z.output<typeof cursorSchema>;
export type StorageNodeCursorOrder = StorageNodeCursor['order'];

export function storageNodeQueryKey(
    input: StorageNodeChildrenInput | StorageNodeDescendantsInput
): string {
    return createHash('sha256')
        .update(
            JSON.stringify({
                organizationId: input.organizationId,
                topologyId: input.topologyId,
                scope: input.scope,
                relation:
                    'parentId' in input
                        ? { kind: 'children', parentId: input.parentId }
                        : { kind: 'descendants', rootNodeId: input.rootNodeId },
            })
        )
        .digest('hex');
}

export function encodeStorageNodeCursor(cursor: StorageNodeCursor): string {
    return Buffer.from(JSON.stringify(cursorSchema.parse(cursor)), 'utf8').toString('base64url');
}

export function decodeStorageNodeCursor(
    encoded: string,
    expected: { queryKey: string; order: StorageNodeCursorOrder }
): StorageNodeCursor {
    if (encoded.length > 512 || !/^[A-Za-z0-9_-]+$/.test(encoded))
        throw new FacilityError({ reason: 'invalid-cursor' });
    let value: unknown;
    try {
        value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
        throw new FacilityError({ reason: 'invalid-cursor' });
    }
    const result = cursorSchema.safeParse(value);
    if (
        !result.success ||
        result.data.queryKey !== expected.queryKey ||
        result.data.order !== expected.order
    )
        throw new FacilityError({ reason: 'invalid-cursor' });
    return result.data;
}
