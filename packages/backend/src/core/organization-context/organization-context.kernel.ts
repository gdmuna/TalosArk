import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { RequestError } from '@/platform/request/request.error.js';
import { OrganizationContextError } from './organization-context.error.js';
import type { OrganizationContext } from './organization-context.types.js';

@Injectable()
export class OrganizationContextKernel {
    constructor(private readonly database: DatabaseRuntime) {}

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
