import { Injectable } from '@nestjs/common';
import type { MaterialBatch } from '@root/prisma/generated/client.js';
import {
    type BatchWrite,
    type BatchUpdate,
    type BatchArchive,
    type BatchQuery,
    type MaterialScope,
} from '@talos-ark/contracts/material';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { PermissionKernel, type PermissionSubject } from '@/core/permission/index.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { ResourceKernel } from '@/core/resource/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { materialPermission as p } from '../contribution/material-authorization.contribution.js';
import { MaterialError } from './material.error.js';
import { materialErrors } from './material.error.mapper.js';
import { materialDateFields } from '../public/material-dates.js';
import { batchView, batchAuditFacts } from '../public/material-batch.view.js';
const scopeOf = (input: MaterialScope): MaterialScope => ({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
});
@Injectable()
export class MaterialBatchService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly authorization: AuthorizationKernel,
        private readonly policies: PermissionKernel,
        private readonly writes: OrganizationWriteKernel,
        private readonly resources: ResourceKernel,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter
    ) {}
    private subject(): PermissionSubject {
        return { kind: 'user', userId: this.actor.requireActor().userId };
    }
    async requireMaterial(
        subject: PermissionSubject,
        scope: MaterialScope,
        materialId: string,
        manage = false
    ) {
        scope = scopeOf(scope);
        await this.authorization.require({
            subject,
            target: { kind: 'workspace', ...scope },
            permissionCode: p.read,
        });
        if (manage)
            await this.authorization.require({
                subject,
                target: { kind: 'workspace', ...scope },
                permissionCode: p.manageBatch,
            });
        const row = await this.database.queryClient.material.findFirst({
            where: { ...scope, id: materialId },
        });
        if (!row) throw new MaterialError({ reason: 'forbidden' });
        return row;
    }
    async requireBatch(scope: MaterialScope, materialId: string, id: string) {
        scope = scopeOf(scope);
        const row = await this.database.queryClient.materialBatch.findFirst({
            where: { ...scope, materialId, id },
        });
        if (!row) throw new MaterialError({ reason: 'forbidden' });
        return row;
    }
    private read<T>(work: () => Promise<T>) {
        return this.database.transaction.run(
            work,
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }
    list(scope: MaterialScope, materialId: string, query: BatchQuery) {
        scope = scopeOf(scope);
        return this.read(async () => {
            await this.requireMaterial(this.subject(), scope, materialId);
            const where = {
                ...scope,
                materialId,
                ...(query.state === 'all'
                    ? {}
                    : { archivedAt: query.state === 'active' ? null : { not: null } }),
                ...(query.q
                    ? { batchNumber: { contains: query.q, mode: 'insensitive' as const } }
                    : {}),
            };
            const total = await this.database.queryClient.materialBatch.count({ where });
            const rows = await this.database.queryClient.materialBatch.findMany({
                where,
                orderBy: [{ batchNumber: 'asc' }, { id: 'asc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            });
            const [manage] = await this.policies.evaluateMany([
                {
                    subject: this.subject(),
                    scope: { kind: 'workspace', ...scope },
                    permissionCode: p.manageBatch,
                },
            ]);
            return {
                items: rows.map(batchView),
                total,
                page: query.page,
                pageSize: query.pageSize,
                canManage: manage.allowed,
            };
        });
    }
    get(scope: MaterialScope, materialId: string, id: string) {
        return this.read(async () => {
            await this.requireMaterial(this.subject(), scope, materialId);
            return batchView(await this.requireBatch(scope, materialId, id));
        });
    }
    create(scope: MaterialScope, materialId: string, body: BatchWrite) {
        scope = scopeOf(scope);
        return materialErrors.run(() =>
            this.writes.run({
                organizationId: scope.organizationId,
                authorize: () => this.requireMaterial(this.subject(), scope, materialId, true),
                execute: () => this.createForReceipt(this.subject(), scope, materialId, body),
            })
        );
    }
    createForReceipt(
        subject: PermissionSubject,
        scope: MaterialScope,
        materialId: string,
        body: BatchWrite
    ) {
        scope = scopeOf(scope);
        return materialErrors.run(() =>
            this.database.transaction.run(
                async () => {
                    const material = await this.requireMaterial(subject, scope, materialId, true);
                    if (material.archivedAt) throw new MaterialError({ reason: 'archived' });
                    const resource = await this.resources.create({
                        organizationId: scope.organizationId,
                        kind: 'MATERIAL_BATCH',
                    });
                    const row = await this.database.queryClient.materialBatch.create({
                        data: {
                            ...scope,
                            materialId,
                            resourceId: resource.id,
                            batchNumber: body.batchNumber,
                            notes: body.notes,
                            ...materialDateFields(body),
                        },
                    });
                    await this.record(scope, row, 'material.batch.create', subject);
                    return batchView(row);
                },
                { propagation: 'mandatory' }
            )
        );
    }
    update(scope: MaterialScope, materialId: string, id: string, body: BatchUpdate) {
        return this.write(scope, materialId, id, body.expectedRevision, async (row) => {
            if (row.archivedAt) throw new MaterialError({ reason: 'archived' });
            return this.database.queryClient.materialBatch.update({
                where: { id },
                data: {
                    batchNumber: body.batchNumber,
                    notes: body.notes,
                    ...materialDateFields(body),
                    revision: { increment: 1 },
                },
            });
        });
    }
    archive(scope: MaterialScope, materialId: string, id: string, body: BatchArchive) {
        return this.write(scope, materialId, id, body.expectedRevision, () =>
            this.database.queryClient.materialBatch.update({
                where: { id },
                data: { archivedAt: body.archived ? new Date() : null, revision: { increment: 1 } },
            })
        );
    }
    private write(
        scope: MaterialScope,
        materialId: string,
        id: string,
        expectedRevision: number,
        work: (row: MaterialBatch) => Promise<MaterialBatch>
    ) {
        scope = scopeOf(scope);
        return materialErrors.run(() =>
            this.writes.run({
                organizationId: scope.organizationId,
                authorize: () => this.requireMaterial(this.subject(), scope, materialId, true),
                execute: async () => {
                    const before = await this.requireBatch(scope, materialId, id);
                    if (before.revision !== expectedRevision)
                        throw new MaterialError({ reason: 'conflict' });
                    const after = await work(before);
                    await this.record(
                        scope,
                        after,
                        'material.batch.update',
                        this.subject(),
                        before
                    );
                    return batchView(after);
                },
            })
        );
    }
    private record(
        scope: MaterialScope,
        row: MaterialBatch,
        action: string,
        subject: PermissionSubject,
        before?: MaterialBatch
    ) {
        if (subject.kind !== 'user') throw new MaterialError({ reason: 'forbidden' });
        return this.audit.record({
            ...scope,
            actorUserId: subject.userId,
            action,
            occurredAt: new Date(),
            resources: [{ resourceId: row.resourceId, labelSnapshot: row.batchNumber }],
            details: {
                batchId: row.id,
                before: before ? batchAuditFacts(before) : null,
                after: batchAuditFacts(row),
            },
        });
    }
}
