import { Injectable } from '@nestjs/common';
import type { Prisma } from '@root/prisma/generated/client.js';
import type { FacilityCapabilities } from '@talos-ark/contracts/facility';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import {
    PermissionKernel,
    AuthorizationExtension,
    type PermissionSubject,
} from '@/core/permission/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import {
    facilityAuthorization,
    facilityPermission as permission,
} from '../contribution/facility-authorization.contribution.js';
import { FacilityError } from '../facility.error.js';

export interface FacilityContext {
    organizationId: string;
    workspaceId?: string;
}
export interface FacilityAccess {
    where: Prisma.FacilityWhereInput;
    capabilities: FacilityCapabilities;
}

@Injectable()
@AuthorizationExtension(facilityAuthorization)
export class FacilityAccessService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly authorization: AuthorizationKernel,
        private readonly policies: PermissionKernel
    ) {}

    async scope(subject: PermissionSubject, context: FacilityContext): Promise<FacilityAccess> {
        const organization = {
            kind: 'organization' as const,
            organizationId: context.organizationId,
        };
        if (await this.policies.isSuperAdmin(subject.userId)) {
            await this.authorization.require({
                subject,
                target: context.workspaceId
                    ? { kind: 'workspace', ...context, workspaceId: context.workspaceId }
                    : organization,
                permissionCode: context.workspaceId ? permission.read : permission.govern,
            });
            return {
                where: { organizationId: context.organizationId },
                capabilities: { read: true, use: true, manage: true, govern: true },
            };
        }
        if (!context.workspaceId) {
            await this.authorization.require({
                subject,
                target: organization,
                permissionCode: permission.govern,
            });
            return {
                where: { organizationId: context.organizationId },
                capabilities: { read: true, use: false, manage: true, govern: true },
            };
        }
        const scope = {
            kind: 'workspace' as const,
            organizationId: context.organizationId,
            workspaceId: context.workspaceId,
        };
        await this.authorization.require({
            subject,
            target: scope,
            permissionCode: permission.read,
        });
        const decisions = await this.policies.evaluateMany([
            { subject, scope, permissionCode: permission.use },
            { subject, scope, permissionCode: permission.manage },
        ]);
        return {
            where: {
                organizationId: context.organizationId,
                OR: [
                    { managementWorkspaceId: context.workspaceId },
                    { workspaceAccess: { some: { workspaceId: context.workspaceId } } },
                ],
            },
            capabilities: {
                read: true,
                use: decisions[0].allowed,
                manage: decisions[1].allowed,
                govern: false,
            },
        };
    }

    async require(
        subject: PermissionSubject,
        context: FacilityContext,
        facilityId: string,
        action: keyof FacilityCapabilities = 'read'
    ) {
        const access = await this.scope(subject, context);
        const facility = await this.database.queryClient.facility.findFirst({
            where: { AND: [access.where, { id: facilityId }] },
        });
        if (!facility) throw new FacilityError({ reason: 'forbidden' });
        let manage = access.capabilities.manage;
        if (
            !access.capabilities.govern &&
            context.workspaceId &&
            facility.managementWorkspaceId !== context.workspaceId
        ) {
            const grant = await this.database.queryClient.facilityWorkspaceAccess.findUnique({
                where: { facilityId_workspaceId: { facilityId, workspaceId: context.workspaceId } },
            });
            manage = manage && grant?.level === 'MANAGE';
        }
        const capabilities = { ...access.capabilities, manage };
        if (!capabilities[action]) throw new FacilityError({ reason: 'forbidden' });
        return { facility, capabilities };
    }
}
