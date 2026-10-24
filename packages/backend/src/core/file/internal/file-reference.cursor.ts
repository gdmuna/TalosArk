import { z } from 'zod';
import type { FileReferenceQuery } from '../file.contract.js';
import { FileError } from '../file.error.js';

const schema = z.strictObject({
    version: z.literal(1),
    organizationId: z.uuid(),
    resourceId: z.uuid(),
    purposeKey: z.string(),
    sortOrder: z.int().min(-2_147_483_648).max(2_147_483_647),
    id: z.uuid(),
});

export function readReferenceCursor(input: FileReferenceQuery) {
    if (!input.cursor) return undefined;
    let raw: unknown;
    try {
        if (!/^[A-Za-z0-9_-]+$/.test(input.cursor)) throw new Error();
        raw = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
    } catch {
        throw new FileError({ reason: 'invalid-cursor' });
    }
    const result = schema.safeParse(raw);
    if (
        !result.success ||
        result.data.organizationId !== input.organizationId ||
        result.data.resourceId !== input.resourceId ||
        result.data.purposeKey !== input.purposeKey
    )
        throw new FileError({ reason: 'invalid-cursor' });
    return { sortOrder: result.data.sortOrder, id: result.data.id.toLowerCase() };
}

export function writeReferenceCursor(
    input: FileReferenceQuery,
    last: { sortOrder: number; id: string }
): string {
    return Buffer.from(
        JSON.stringify({
            version: 1,
            organizationId: input.organizationId,
            resourceId: input.resourceId,
            purposeKey: input.purposeKey,
            sortOrder: last.sortOrder,
            id: last.id,
        })
    ).toString('base64url');
}
