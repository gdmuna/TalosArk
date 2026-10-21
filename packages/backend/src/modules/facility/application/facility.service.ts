import { Injectable } from '@nestjs/common';
import {
    FacilitySchema,
    FacilityDetailSchema,
    FacilityPageSchema,
    type FacilityWrite,
    type FacilityUpdate,
    type FacilityQuery,
    type FacilityGrant,
    type FacilityState,
} from '@talos-ark/contracts/facility';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { PermissionKernel } from '@/core/permission/index.js';
import { organizationPermission } from '@/core/team-governance/index.js';
import { ResourceKernel } from '@/core/resource/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { FacilityAccessService, type FacilityContext } from './facility-access.service.js';
import { facilityPermission } from '../contribution/facility-authorization.contribution.js';
import { facilityErrors } from './facility.error.mapper.js';
import { FacilityOperations } from './facility.operations.js';
import { FacilityError } from '../facility.error.js';

@Injectable()
export class FacilityService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly access: FacilityAccessService,
        private readonly writes: OrganizationWriteKernel,
        private readonly authorization: AuthorizationKernel,
        private readonly resources: ResourceKernel,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter,
        private readonly operations: FacilityOperations,
        private readonly policies: PermissionKernel
    ) {}

    governance(organizationId: string) {
        return this.operations.read(async () => {
            const target = { kind: 'organization' as const, organizationId };
            const context = await this.authorization.require({
                subject: this.operations.subject(),
                target,
                permissionCode: organizationPermission.read,
            });
            const decisions = await this.policies.evaluateMany(
                [facilityPermission.create, facilityPermission.govern].map((permissionCode) => ({
                    subject: this.operations.subject(),
                    scope: target,
                    permissionCode,
                }))
            );
            const ownerOrAdministrator =
                context.organization.isOwner || context.organization.isSuperAdmin;
            const manager = ownerOrAdministrator
                ? await this.policies.findRole({
                      organizationId,
                      scope: 'WORKSPACE',
                      code: 'workspace-manager',
                  })
                : null;
            const needsManagerGrants =
                manager &&
                !manager.archivedAt &&
                [facilityPermission.read, facilityPermission.use, facilityPermission.manage].some(
                    (code) => !manager.permissions.includes(code)
                );
            return {
                canCreate: decisions[0].allowed && decisions[1].allowed,
                canGovern: decisions[1].allowed,
                canInitialize:
                    ownerOrAdministrator &&
                    (!decisions[0].allowed || !decisions[1].allowed || !!needsManagerGrants),
            };
        });
    }
    initialize(organizationId: string) {
        return this.writes.run({
            organizationId,
            authorize: async () => {
                const context = await this.authorization.require({
                    subject: this.operations.subject(),
                    target: { kind: 'organization', organizationId },
                    permissionCode: organizationPermission.read,
                });
                if (!context.organization.isOwner && !context.organization.isSuperAdmin)
                    throw new FacilityError({ reason: 'forbidden' });
            },
            execute: async () => {
                const role = await this.policies.findRole({
                    organizationId,
                    scope: 'ORGANIZATION',
                    code: 'organization-owner',
                });
                if (!role || role.archivedAt) throw new FacilityError({ reason: 'invalid-state' });
                const permissions = [
                    ...new Set([
                        ...role.permissions,
                        facilityPermission.create,
                        facilityPermission.govern,
                    ]),
                ];
                const ownerChanged = permissions.length !== role.permissions.length;
                if (ownerChanged) {
                    await this.policies.setRolePermissions({
                        organizationId,
                        roleId: role.id,
                        permissions,
                    });
                }
                const manager = await this.policies.findRole({
                    organizationId,
                    scope: 'WORKSPACE',
                    code: 'workspace-manager',
                });
                const managerPermissions = manager
                    ? [
                          ...new Set([
                              ...manager.permissions,
                              facilityPermission.read,
                              facilityPermission.use,
                              facilityPermission.manage,
                          ]),
                      ]
                    : [];
                const managerChanged =
                    !!manager &&
                    !manager.archivedAt &&
                    managerPermissions.length !== manager.permissions.length;
                if (managerChanged && manager)
                    await this.policies.setRolePermissions({
                        organizationId,
                        roleId: manager.id,
                        permissions: managerPermissions,
                    });
                const updated = ownerChanged || managerChanged;
                if (updated) {
                    await this.audit.record({
                        organizationId,
                        actorUserId: this.operations.subject().userId,
                        action: 'facility.initialize',
                        occurredAt: new Date(),
                        details: { roleId: role.id },
                        requestId: this.actor.get()?.requestId,
                    });
                }
                return { updated };
            },
        });
    }
    private async workspace(organizationId: string, workspaceId: string) {
        if (
            !(await this.database.queryClient.workspace.findFirst({
                where: { id: workspaceId, organizationId, archivedAt: null },
                select: { id: true },
            }))
        )
            throw new FacilityError({ reason: 'invalid-input' });
    }
    private async project(
        facility: Awaited<ReturnType<FacilityAccessService['require']>>['facility'],
        context: FacilityContext
    ) {
        const { capabilities } = await this.access.require(
            this.operations.subject(),
            context,
            facility.id
        );
        return FacilitySchema.parse({
            ...facility,
            createdAt: facility.createdAt.toISOString(),
            updatedAt: facility.updatedAt.toISOString(),
            disabledAt: facility.disabledAt?.toISOString() ?? null,
            archivedAt: facility.archivedAt?.toISOString() ?? null,
            capabilities,
        });
    }
    list(context: FacilityContext, query: FacilityQuery) {
        return this.operations.read(async () => {
            const access = await this.access.scope(this.operations.subject(), context);
            const search = { contains: query.q, mode: 'insensitive' as const };
            const where = {
                AND: [
                    access.where,
                    {
                        ...(query.state === 'all'
                            ? {}
                            : { archivedAt: query.state === 'active' ? null : { not: null } }),
                        ...(query.q
                            ? { OR: [{ code: search }, { name: search }, { location: search }] }
                            : {}),
                    },
                ],
            };
            const total = await this.database.queryClient.facility.count({ where });
            const rows = await this.database.queryClient.facility.findMany({
                where,
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: {
                    workspaceAccess: {
                        where: { workspaceId: context.workspaceId },
                        select: { workspaceId: true, level: true },
                    },
                },
            });
            return FacilityPageSchema.parse({
                total,
                page: query.page,
                pageSize: query.pageSize,
                items: rows.map(({ workspaceAccess, ...row }) => ({
                    ...row,
                    disabledAt: row.disabledAt?.toISOString() ?? null,
                    archivedAt: row.archivedAt?.toISOString() ?? null,
                    createdAt: row.createdAt.toISOString(),
                    updatedAt: row.updatedAt.toISOString(),
                    capabilities: {
                        ...access.capabilities,
                        manage:
                            access.capabilities.manage &&
                            (access.capabilities.govern ||
                                !context.workspaceId ||
                                row.managementWorkspaceId === context.workspaceId ||
                                workspaceAccess.some((grant) => grant.level === 'MANAGE')),
                    },
                })),
            });
        });
    }
    detail(context: FacilityContext, facilityId: string) {
        return this.operations.read(async () => {
            const { facility, capabilities } = await this.access.require(
                this.operations.subject(),
                context,
                facilityId
            );
            const topology = await this.database.queryClient.storageTopology.findFirst({
                where: { facilityId, organizationId: context.organizationId, archivedAt: null },
                select: { id: true, resourceId: true, name: true, revision: true },
            });
            const nodeCount = await this.database.queryClient.storageNode.count({
                where: {
                    organizationId: context.organizationId,
                    topology: { facilityId },
                    archivedAt: null,
                },
            });
            const grants = capabilities.govern
                ? await this.database.queryClient.facilityWorkspaceAccess.findMany({
                      where: { facilityId },
                      select: {
                          workspaceId: true,
                          level: true,
                          workspace: { select: { name: true } },
                      },
                  })
                : null;
            return FacilityDetailSchema.parse({
                ...(await this.project(facility, context)),
                topology,
                nodeCount,
                workspaceAccess:
                    grants?.map((grant) => ({
                        workspaceId: grant.workspaceId,
                        level: grant.level,
                        name: grant.workspace.name,
                    })) ?? null,
            });
        });
    }
    create(organizationId: string, body: FacilityWrite) {
        return facilityErrors.run(() =>
            this.writes.run({
                organizationId,
                authorize: () =>
                    this.authorization.require({
                        subject: this.operations.subject(),
                        permissionCode: facilityPermission.create,
                        target: { kind: 'organization', organizationId },
                    }),
                execute: async () => {
                    await this.authorization.require({
                        subject: this.operations.subject(),
                        permissionCode: facilityPermission.govern,
                        target: { kind: 'organization', organizationId },
                    });
                    await this.workspace(organizationId, body.managementWorkspaceId);
                    const resource = await this.resources.create({
                        organizationId,
                        kind: 'FACILITY',
                    });
                    const layout = await this.resources.create({
                        organizationId,
                        kind: 'STORAGE_TOPOLOGY',
                    });
                    const facility = await this.database.queryClient.facility.create({
                        data: { organizationId, resourceId: resource.id, ...body },
                    });
                    await this.database.queryClient.storageTopology.create({
                        data: {
                            organizationId,
                            facilityId: facility.id,
                            resourceId: layout.id,
                            name: body.name,
                        },
                    });
                    await this.operations.record(
                        { organizationId },
                        'facility.create',
                        facility.resourceId,
                        facility.name,
                        {
                            facilityId: facility.id,
                            managementWorkspaceId: body.managementWorkspaceId,
                        }
                    );
                    return this.project(facility, { organizationId });
                },
            })
        );
    }
    private async revise(facilityId: string, expectedRevision: number) {
        const changed = await this.database.queryClient.facility.updateMany({
            where: { id: facilityId, revision: expectedRevision },
            data: { revision: { increment: 1 } },
        });
        if (changed.count !== 1) throw new FacilityError({ reason: 'conflict' });
    }
    update(organizationId: string, facilityId: string, body: FacilityUpdate) {
        return this.operations.write(
            { organizationId },
            facilityId,
            'govern',
            async ({ facility }) => {
                if (facility.archivedAt) throw new FacilityError({ reason: 'invalid-state' });
                await this.workspace(organizationId, body.managementWorkspaceId);
                if (facility.managementWorkspaceId !== body.managementWorkspaceId)
                    await this.assertNoPlacement(facilityId, facility.managementWorkspaceId);
                await this.revise(facilityId, body.expectedRevision);
                const { expectedRevision: _revision, ...data } = body;
                const updated = await this.database.queryClient.facility.update({
                    where: { id: facilityId },
                    data,
                });
                await this.operations.record(
                    { organizationId },
                    'facility.update',
                    facility.resourceId,
                    updated.name,
                    { facilityId }
                );
                return this.project(updated, { organizationId });
            }
        );
    }
    async assertNoPlacement(facilityId: string, workspaceId?: string) {
        const occupied = await this.database.queryClient.placement.findFirst({
            where: {
                ...(workspaceId ? { workspaceId } : {}),
                storageNode: { topology: { facilityId } },
            },
            select: { id: true },
        });
        if (occupied) throw new FacilityError({ reason: 'occupied' });
    }
    grant(organizationId: string, facilityId: string, body: FacilityGrant) {
        return this.operations.write(
            { organizationId },
            facilityId,
            'govern',
            async ({ facility }) => {
                if (facility.archivedAt || facility.managementWorkspaceId === body.workspaceId)
                    throw new FacilityError({ reason: 'invalid-state' });
                await this.workspace(organizationId, body.workspaceId);
                if (body.level === null) await this.assertNoPlacement(facilityId, body.workspaceId);
                await this.revise(facilityId, body.expectedRevision);
                const where = {
                    facilityId_workspaceId: { facilityId, workspaceId: body.workspaceId },
                };
                if (body.level)
                    await this.database.queryClient.facilityWorkspaceAccess.upsert({
                        where,
                        create: {
                            organizationId,
                            facilityId,
                            workspaceId: body.workspaceId,
                            level: body.level,
                        },
                        update: { level: body.level },
                    });
                else
                    await this.database.queryClient.facilityWorkspaceAccess.deleteMany({
                        where: { facilityId, workspaceId: body.workspaceId },
                    });
                await this.operations.record(
                    { organizationId },
                    'facility.access',
                    facility.resourceId,
                    facility.name,
                    { workspaceId: body.workspaceId, level: body.level }
                );
                return { revision: body.expectedRevision + 1 };
            }
        );
    }
    state(organizationId: string, facilityId: string, body: FacilityState) {
        return this.operations.write(
            { organizationId },
            facilityId,
            'govern',
            async ({ facility }) => {
                if (body.state === 'archived') {
                    await this.assertNoPlacement(facilityId);
                    if (
                        await this.database.queryClient.storageNode.findFirst({
                            where: { topology: { facilityId }, archivedAt: null },
                            select: { id: true },
                        })
                    )
                        throw new FacilityError({ reason: 'invalid-state' });
                }
                await this.revise(facilityId, body.expectedRevision);
                const updated = await this.database.queryClient.facility.update({
                    where: { id: facilityId },
                    data: {
                        archivedAt: body.state === 'archived' ? new Date() : null,
                        disabledAt: body.state === 'disabled' ? new Date() : null,
                    },
                });
                await this.operations.record(
                    { organizationId },
                    'facility.state',
                    facility.resourceId,
                    facility.name,
                    { state: body.state }
                );
                return this.project(updated, { organizationId });
            }
        );
    }
}
