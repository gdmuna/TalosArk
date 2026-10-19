import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { SystemAccessKernel } from '@/core/system-access/index.js';
import { RequestError } from '@/platform/request/request.error.js';
import { OrganizationContextError } from './organization-context.error.js';
import type {
    OrganizationContext,
    OrganizationAccessContext,
} from './organization-context.types.js';

@Injectable()
export class OrganizationContextKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly systemAccess: SystemAccessKernel
    ) {}

    async requireAccess(
        userId: string,
        organizationId: string
    ): Promise<OrganizationAccessContext> {
        const organization = await this.database.queryClient.organization.findFirst({
            where: { id: organizationId, archivedAt: null },
            select: {
                name: true,
                ownerUserId: true,
                members: { where: { userId, status: 'ACTIVE' }, select: { id: true }, take: 1 },
            },
        });
        if (!organization) throw new OrganizationContextError({ reason: 'forbidden' });
        const isSuperAdmin = await this.systemAccess.isSuperAdmin(userId);
        const member = organization.members[0];
        if (!member && !isSuperAdmin) throw new OrganizationContextError({ reason: 'forbidden' });
        return Object.freeze({
            userId,
            organizationId,
            organizationMemberId: member?.id ?? null,
            name: organization.name,
            isOwner: organization.ownerUserId === userId,
            isSuperAdmin,
        });
    }

    async requireUser(userId: string): Promise<void> {
        const user = await this.database.queryClient.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });
        if (!user) throw new RequestError({ reason: 'authentication' });
    }

    async requireMembership(userId: string, organizationId: string): Promise<OrganizationContext> {
        const member = await this.database.queryClient.organizationMember.findFirst({
            where: { userId, organizationId, status: 'ACTIVE', organization: { archivedAt: null } },
            select: {
                id: true,
                organization: { select: { id: true, name: true, ownerUserId: true } },
            },
        });
        if (!member) throw new OrganizationContextError({ reason: 'forbidden' });
        return Object.freeze({
            userId,
            organizationId,
            organizationMemberId: member.id,
            name: member.organization.name,
            isOwner: member.organization.ownerUserId === userId,
        });
    }
}
