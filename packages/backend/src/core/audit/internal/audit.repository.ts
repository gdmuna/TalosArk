import { Injectable } from '@nestjs/common';
import { Prisma } from '@root/prisma/generated/client.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuditError } from '../audit.error.js';
import type { AuditEventSnapshot, AuditReceipt, AuditValue } from '../audit.contract.js';
import type { ParsedAuditList, ParsedAuditRecord } from './audit.input.js';

const eventSelect = {
    id: true,
    organizationId: true,
    workspaceId: true,
    actorUserId: true,
    action: true,
    occurredAt: true,
    requestId: true,
    details: true,
    resources: {
        select: { resourceId: true, labelSnapshot: true },
        orderBy: { resourceId: 'asc' },
    },
} satisfies Prisma.AuditEventSelect;

@Injectable()
export class AuditRepository {
    constructor(private readonly database: DatabaseRuntime) {}

    async append(input: ParsedAuditRecord): Promise<AuditReceipt> {
        const client = this.database.queryClient;
        const organization = await client.organization.findUnique({
            where: { id: input.organizationId },
            select: { id: true },
        });
        if (!organization) throw new AuditError({ reason: 'scope-not-found' });
        if (input.workspaceId) {
            const workspace = await client.workspace.findUnique({
                where: {
                    organizationId_id: {
                        organizationId: input.organizationId,
                        id: input.workspaceId,
                    },
                },
                select: { id: true },
            });
            if (!workspace) throw new AuditError({ reason: 'scope-not-found' });
        }
        const actor = await client.user.findUnique({
            where: { id: input.actorUserId },
            select: { id: true },
        });
        if (!actor) throw new AuditError({ reason: 'actor-not-found' });
        if (input.resources.length) {
            const count = await client.resourceIdentity.count({
                where: {
                    organizationId: input.organizationId,
                    id: { in: input.resources.map((resource) => resource.resourceId) },
                },
            });
            if (count !== input.resources.length)
                throw new AuditError({ reason: 'resource-scope' });
        }
        // Composite FKs independently enforce organization consistency at the actual write.
        return client.auditEvent.create({
            data: {
                organizationId: input.organizationId,
                workspaceId: input.workspaceId,
                actorUserId: input.actorUserId,
                action: input.action,
                occurredAt: input.occurredAt,
                requestId: input.requestId,
                details: input.details as Prisma.InputJsonObject | undefined,
                resources: {
                    create: input.resources,
                },
            },
            select: { id: true, occurredAt: true },
        });
    }

    async list(input: ParsedAuditList, cursor?: AuditReceipt): Promise<AuditEventSnapshot[]> {
        const rows = await this.database.queryClient.auditEvent.findMany({
            where: {
                organizationId: input.scope.organizationId,
                ...(input.scope.kind === 'workspace'
                    ? { workspaceId: input.scope.workspaceId }
                    : {}),
                ...(input.resourceId
                    ? { resources: { some: { resourceId: input.resourceId } } }
                    : {}),
                occurredAt: { gte: input.from, lt: input.until },
                ...(cursor
                    ? {
                          OR: [
                              { occurredAt: { lt: cursor.occurredAt } },
                              { occurredAt: cursor.occurredAt, id: { lt: cursor.id } },
                          ],
                      }
                    : {}),
            },
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            take: input.limit + 1,
            select: eventSelect,
        });
        // Stored PostgreSQL JSON cannot contain Prisma's optional undefined object members.
        return rows.map((row) => ({ ...row, details: row.details as AuditValue }));
    }
}
