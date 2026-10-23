import { Injectable } from '@nestjs/common';
import type { Prisma } from '@root/prisma/generated/client.js';
import {
    MaterialScopeSchema,
    MaterialWriteSchema,
    MaterialTypeWriteSchema,
    MaterialQuerySchema,
    type Material,
    type MaterialArchive,
    type MaterialCapabilities,
    type MaterialDetail,
    type MaterialOverview,
    type MaterialPage,
    type MaterialQuery,
    type MaterialScope,
    type MaterialTypeList,
    type MaterialTypeWrite,
    type MaterialWrite,
} from '@talos-ark/contracts/material';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { AuthorizationExtension, PermissionKernel } from '@/core/permission/index.js';
import { ResourceKernel } from '@/core/resource/index.js';
import { AuditKernel, type AuditValue } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import {
    materialAuthorization,
    materialPermission as permission,
} from '../contribution/material-authorization.contribution.js';
import { MaterialError } from './material.error.js';
import { materialErrors } from './material.error.mapper.js';
import {
    materialSelect,
    materialTypeSelect,
    materialView,
    materialTypeView,
} from './material.projection.js';

function materialScope(input: MaterialScope): MaterialScope {
    return MaterialScopeSchema.parse({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
    });
}

@Injectable()
@AuthorizationExtension(materialAuthorization)
export class MaterialService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly authorization: AuthorizationKernel,
        private readonly policies: PermissionKernel,
        private readonly resources: ResourceKernel,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter,
        private readonly writes: OrganizationWriteKernel
    ) {}

    private subject() {
        return { kind: 'user' as const, userId: this.actor.requireActor().userId };
    }
    private scope(input: MaterialScope) {
        return { kind: 'workspace' as const, ...materialScope(input) };
    }

    private async capabilities(input: MaterialScope): Promise<MaterialCapabilities> {
        const keys = Object.keys(permission) as (keyof typeof permission)[];
        const decisions = await this.policies.evaluateMany(
            keys.map((key) => ({
                subject: this.subject(),
                permissionCode: permission[key],
                scope: this.scope(input),
            }))
        );
        return Object.fromEntries(
            keys.map((key, index) => [key, decisions[index].allowed])
        ) as MaterialCapabilities;
    }

    private read<T>(work: () => Promise<T>): Promise<T> {
        return this.database.transaction.run(
            work,
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }

    private async readable(input: MaterialScope): Promise<Prisma.MaterialWhereInput> {
        const scope = this.scope(input);
        await this.authorization.require({
            subject: this.subject(),
            permissionCode: permission.read,
            target: scope,
        });
        const access = await this.authorization.scope({
            subject: this.subject(),
            permissionCode: permission.read,
            within: scope,
        });
        return {
            OR:
                access.kind === 'workspace'
                    ? access.workspaces.map((item) => ({
                          organizationId: item.organizationId,
                          workspaceId: item.workspaceId,
                      }))
                    : [],
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
        };
    }

    private write<T>(
        input: MaterialScope,
        permissionCode: string,
        materialId: string | undefined,
        work: () => Promise<T>
    ): Promise<T> {
        const scope = this.scope(input);
        return materialErrors.run(() =>
            this.writes.run({
                organizationId: scope.organizationId,
                authorize: async () => {
                    await this.authorization.require({
                        subject: this.subject(),
                        permissionCode: permission.read,
                        target: scope,
                    });
                    await this.authorization.require({
                        subject: this.subject(),
                        permissionCode,
                        target: materialId ? { kind: 'material', id: materialId } : scope,
                        expectedScope: scope,
                    });
                },
                execute: async () => {
                    if (materialId)
                        await this.database.queryClient.$queryRaw`
                SELECT "id" FROM public."Material" WHERE "id" = ${materialId}::uuid FOR UPDATE`;
                    return work();
                },
            })
        );
    }

    private record(
        input: MaterialScope,
        action: string,
        details: Record<string, AuditValue>,
        material?: Pick<Material, 'resourceId' | 'name'>
    ) {
        return this.audit.record({
            ...materialScope(input),
            actorUserId: this.actor.requireActor().userId,
            action,
            occurredAt: new Date(),
            requestId: this.actor.get()?.requestId,
            details,
            resources: material
                ? [{ resourceId: material.resourceId, labelSnapshot: material.name }]
                : undefined,
        });
    }

    private async classification(input: MaterialScope, typeId: string, allowArchived = false) {
        const type = await this.database.queryClient.materialType.findFirst({
            where: {
                ...materialScope(input),
                id: typeId,
                ...(allowArchived ? {} : { archivedAt: null }),
            },
            select: materialTypeSelect,
        });
        if (!type) throw new MaterialError({ reason: 'classification-unavailable' });
        return type;
    }

    private fields(body: MaterialWrite) {
        return {
            code: body.code,
            name: body.name,
            typeId: body.typeId,
            description: body.description || null,
            branch: body.branch,
            attributes: body.attributes,
            manufacturer: body.manufacturer || null,
            catalogNumber: body.catalogNumber || null,
            quantityUnit: body.quantityUnit,
            quantityScale: body.quantityScale,
            aliases: { create: body.aliases.map((name) => ({ name })) },
            identifiers: { create: body.identifiers.map((item) => ({ ...item })) },
        };
    }

    list(input: MaterialScope, request: MaterialQuery): Promise<MaterialPage> {
        return this.read(async () => {
            const query = MaterialQuerySchema.parse(request);
            const authorized = await this.readable(input);
            const search: Prisma.StringFilter = { contains: query.q, mode: 'insensitive' };
            const where: Prisma.MaterialWhereInput = {
                AND: [
                    authorized,
                    {
                        ...(query.state === 'active'
                            ? { archivedAt: null }
                            : query.state === 'archived'
                              ? { archivedAt: { not: null } }
                              : {}),
                        ...(query.branch
                            ? {
                                  branch: {
                                      in: Array.isArray(query.branch)
                                          ? query.branch
                                          : [query.branch],
                                  },
                              }
                            : {}),
                        ...(query.typeId
                            ? {
                                  typeId: {
                                      in: Array.isArray(query.typeId)
                                          ? query.typeId
                                          : [query.typeId],
                                  },
                              }
                            : {}),
                        ...(query.q
                            ? {
                                  OR: [
                                      { code: search },
                                      { name: search },
                                      { description: search },
                                      { manufacturer: search },
                                      { catalogNumber: search },
                                      { type: { name: search } },
                                      { aliases: { some: { name: search } } },
                                      { identifiers: { some: { value: search } } },
                                  ],
                              }
                            : {}),
                    },
                ],
            };
            const orderBy: Prisma.MaterialOrderByWithRelationInput[] = query.sort
                .split(',')
                .map((item) => {
                    const [key, direction] = item.split(':');
                    const order = direction === 'asc' ? ('asc' as const) : ('desc' as const);
                    return key === 'type'
                        ? { type: { name: order } }
                        : key === 'status'
                          ? { archivedAt: order }
                          : { [key]: order };
                });
            orderBy.push({ id: 'asc' });
            const total = await this.database.queryClient.material.count({ where });
            const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
            const items = await this.database.queryClient.material.findMany({
                where,
                orderBy,
                skip: (page - 1) * query.pageSize,
                take: query.pageSize,
                select: materialSelect,
            });
            return {
                items: items.map(materialView),
                total,
                page,
                pageSize: query.pageSize,
                capabilities: await this.capabilities(input),
            };
        });
    }

    get(input: MaterialScope & { materialId: string }): Promise<MaterialDetail> {
        return this.read(async () => {
            const scope = this.scope(input);
            await this.authorization.require({
                subject: this.subject(),
                permissionCode: permission.read,
                target: { kind: 'material', id: input.materialId },
                expectedScope: scope,
            });
            const row = await this.database.queryClient.material.findUniqueOrThrow({
                where: { id: input.materialId },
                select: materialSelect,
            });
            return { material: materialView(row), capabilities: await this.capabilities(scope) };
        });
    }

    create(input: MaterialScope, request: MaterialWrite): Promise<Material> {
        const scope = materialScope(input);
        const body = MaterialWriteSchema.parse(request);
        return this.write(scope, permission.create, undefined, async () => {
            await this.classification(scope, body.typeId);
            const identity = await this.resources.create({
                organizationId: scope.organizationId,
                kind: 'MATERIAL',
            });
            const row = await this.database.queryClient.material.create({
                data: {
                    ...scope,
                    resourceId: identity.id,
                    ...this.fields(body),
                    code: body.code ?? null,
                },
                select: materialSelect,
            });
            const material = materialView(row);
            await this.record(
                scope,
                'material.create',
                { materialId: material.id, code: material.code, branch: material.branch },
                material
            );
            return material;
        });
    }

    update(
        input: MaterialScope & { materialId: string },
        request: MaterialWrite
    ): Promise<Material> {
        const scope = this.scope(input);
        const body = MaterialWriteSchema.parse(request);
        return this.write(scope, permission.update, input.materialId, async () => {
            const current = await this.database.queryClient.material.findUniqueOrThrow({
                where: { id: input.materialId },
                select: materialSelect,
            });
            if (current.archivedAt) throw new MaterialError({ reason: 'archived' });
            if (
                current._count.instances &&
                (current.quantityUnit !== body.quantityUnit ||
                    current.quantityScale !== body.quantityScale ||
                    current.branch !== body.branch)
            )
                throw new MaterialError({ reason: 'instance-locked' });
            await this.classification(
                materialScope(input),
                body.typeId,
                current.typeId === body.typeId
            );
            await this.database.queryClient.materialAlias.deleteMany({
                where: { materialId: current.id },
            });
            await this.database.queryClient.materialIdentifier.deleteMany({
                where: { materialId: current.id },
            });
            const row = await this.database.queryClient.material.update({
                where: { id: current.id },
                data: this.fields(body),
                select: materialSelect,
            });
            const material = materialView(row);
            await this.record(
                materialScope(input),
                'material.update',
                { materialId: material.id, code: material.code },
                material
            );
            return material;
        });
    }

    archive(
        input: MaterialScope & { materialId: string },
        body: MaterialArchive
    ): Promise<Material> {
        const scope = materialScope(input);
        return this.write(scope, permission.archive, input.materialId, async () => {
            const current = await this.database.queryClient.material.findUniqueOrThrow({
                where: { id: input.materialId },
                select: materialSelect,
            });
            if (!body.archived) await this.classification(scope, current.typeId);
            const row = await this.database.queryClient.material.update({
                where: { id: current.id },
                data: { archivedAt: body.archived ? (current.archivedAt ?? new Date()) : null },
                select: materialSelect,
            });
            const material = materialView(row);
            if (!!current.archivedAt !== body.archived)
                await this.record(
                    scope,
                    body.archived ? 'material.archive' : 'material.restore',
                    { materialId: material.id },
                    material
                );
            return material;
        });
    }

    types(input: MaterialScope): Promise<MaterialTypeList> {
        return this.read(async () => {
            await this.readable(input);
            const items = await this.database.queryClient.materialType.findMany({
                where: materialScope(input),
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                select: materialTypeSelect,
            });
            return {
                items: items.map(materialTypeView),
                capabilities: await this.capabilities(input),
            };
        });
    }

    createType(input: MaterialScope, request: MaterialTypeWrite) {
        const scope = materialScope(input),
            body = MaterialTypeWriteSchema.parse(request);
        return this.write(scope, permission.manageType, undefined, async () => {
            const row = await this.database.queryClient.materialType.create({
                data: { ...scope, ...body, code: body.code ?? null },
                select: materialTypeSelect,
            });
            await this.record(scope, 'material.type.create', {
                typeId: row.id,
                code: row.code,
                name: row.name,
            });
            return materialTypeView(row);
        });
    }

    updateType(input: MaterialScope & { typeId: string }, request: MaterialTypeWrite) {
        const scope = materialScope(input),
            body = MaterialTypeWriteSchema.parse(request);
        return this.write(scope, permission.manageType, undefined, async () => {
            const current = await this.classification(scope, input.typeId);
            const row = await this.database.queryClient.materialType.update({
                where: { id: current.id },
                data: body,
                select: materialTypeSelect,
            });
            await this.record(scope, 'material.type.update', {
                typeId: row.id,
                code: row.code,
                name: row.name,
            });
            return materialTypeView(row);
        });
    }

    archiveType(input: MaterialScope & { typeId: string }, body: MaterialArchive) {
        const scope = materialScope(input);
        return this.write(scope, permission.manageType, undefined, async () => {
            const current = await this.classification(scope, input.typeId, true);
            const row = await this.database.queryClient.materialType.update({
                where: { id: current.id },
                data: { archivedAt: body.archived ? (current.archivedAt ?? new Date()) : null },
                select: materialTypeSelect,
            });
            if (!!current.archivedAt !== body.archived)
                await this.record(
                    scope,
                    body.archived ? 'material.type.archive' : 'material.type.restore',
                    { typeId: row.id }
                );
            return materialTypeView(row);
        });
    }

    overview(input: MaterialScope): Promise<MaterialOverview> {
        return this.read(async () => {
            const where = await this.readable(input);
            const total = await this.database.queryClient.material.count({ where });
            const activeWhere = { AND: [where, { archivedAt: null }] };
            const active = await this.database.queryClient.material.count({ where: activeWhere });
            const recent = await this.database.queryClient.material.findMany({
                where: activeWhere,
                orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
                take: 8,
                select: materialSelect,
            });
            const grouped = await this.database.queryClient.material.groupBy({
                by: ['branch'],
                where: activeWhere,
                _count: { _all: true },
            });
            const to = new Date();
            const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
            from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7) - 21);
            const week = 7 * 24 * 60 * 60 * 1000;
            const points = [];
            for (let index = 0; index < 4; index++) {
                const start = new Date(from.getTime() + index * week);
                const end = new Date(Math.min(to.getTime(), start.getTime() + week));
                const count = await this.database.queryClient.material.count({
                    where: { AND: [where, { createdAt: { gte: start, lt: end } }] },
                });
                points.push({ from: start.toISOString(), to: end.toISOString(), count });
            }
            return {
                total,
                active,
                archived: total - active,
                branches: grouped.map((item) => ({ branch: item.branch, count: item._count._all })),
                recent: recent.map(materialView),
                creations: {
                    from: from.toISOString(),
                    to: to.toISOString(),
                    timeZone: 'UTC',
                    points,
                },
                capabilities: await this.capabilities(input),
            };
        });
    }
}
