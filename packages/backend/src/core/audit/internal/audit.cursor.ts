import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AuditError } from '../audit.error.js';
import type { AuditReceipt } from '../audit.contract.js';
import type { ParsedAuditList } from './audit.input.js';

const cursorSchema = z.strictObject({
    version: z.literal(1),
    query: z.string().regex(/^[a-f0-9]{64}$/),
    occurredAt: z.iso.datetime({ precision: 3 }).refine((value) => !value.startsWith('0000-')),
    id: z.uuid(),
});

function queryKey(input: ParsedAuditList): string {
    return createHash('sha256')
        .update(
            JSON.stringify({
                scope: input.scope.kind,
                organizationId: input.scope.organizationId,
                workspaceId: input.scope.kind === 'workspace' ? input.scope.workspaceId : null,
                resourceId: input.resourceId ?? null,
                actions: input.actions ? [...input.actions].sort() : null,
                detailsMatch: input.detailsMatch ?? null,
                from: input.from?.toISOString() ?? null,
                until: input.until?.toISOString() ?? null,
            })
        )
        .digest('hex');
}

export function readAuditCursor(input: ParsedAuditList): AuditReceipt | undefined {
    if (!input.cursor) return undefined;
    const invalid = () => new AuditError({ reason: 'invalid-cursor' });
    if (!/^[A-Za-z0-9_-]+$/.test(input.cursor)) throw invalid();
    let raw: unknown;
    try {
        raw = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
    } catch {
        throw invalid();
    }
    const result = cursorSchema.safeParse(raw);
    if (!result.success || result.data.query !== queryKey(input)) throw invalid();
    return { id: result.data.id.toLowerCase(), occurredAt: new Date(result.data.occurredAt) };
}

export function writeAuditCursor(input: ParsedAuditList, last: AuditReceipt): string {
    return Buffer.from(
        JSON.stringify({
            version: 1,
            query: queryKey(input),
            id: last.id,
            occurredAt: last.occurredAt.toISOString(),
        })
    ).toString('base64url');
}
