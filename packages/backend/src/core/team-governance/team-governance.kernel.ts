import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationContextKernel } from '@/core/organization-context/index.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { PermissionKernel } from '@/core/permission/index.js';
import type {
    OrganizationGovernanceInput,
    TeamGovernanceInput,
    WorkspaceGovernanceInput,
    TeamGovernanceSnapshot,
    WorkspaceGovernanceSnapshot,
    TeamMemberVisibility,
} from './team-governance.contract.js';
import {
    organizationPermission as op,
    workspacePermission as wp,
    type OrganizationGovernancePermission,
} from './team-governance.permission.js';
import { TeamGovernanceError } from './team-governance.error.js';

@Injectable()
export class TeamGovernanceKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly organization: OrganizationContextKernel,
        private readonly authorization: AuthorizationKernel,
        private readonly permission: PermissionKernel
    ) {}

    readTeam(input: TeamGovernanceInput): Promise<TeamGovernanceSnapshot> {
        return this.read(async () => {
            const { subject, organizationId, workspaceId } = input;
            const target = { kind: 'organization' as const, organizationId };
            const membership = await this.organization.requireAccess(
                subject.userId,
                organizationId
            );
            await this.authorization.require({ subject, permissionCode: op.read, target });
            const grants = await this.permission.evaluateMany(
                [op.members, op.roles, op.invitations].map((permissionCode) => ({
                    subject,
                    permissionCode,
                    scope: target,
                }))
            );
            const ownerOrAdministrator = membership.isOwner || membership.isSuperAdmin;
            const canManageOrganizationMembers = ownerOrAdministrator && grants[0].allowed;
            let workspaceManager = false;
            if (workspaceId) {
                await this.requireWorkspace(organizationId, workspaceId);
                if (!canManageOrganizationMembers) {
                    const scope = { kind: 'workspace' as const, organizationId, workspaceId };
                    await this.authorization.require({
                        subject,
                        permissionCode: wp.read,
                        target: scope,
                    });
                    workspaceManager = (
                        await this.permission.evaluate({
                            subject,
                            permissionCode: wp.members,
                            scope,
                        })
                    ).allowed;
                }
            }
            const memberVisibility: TeamMemberVisibility = canManageOrganizationMembers
                ? Object.freeze({ kind: 'organization', organizationId })
                : workspaceManager && workspaceId
                  ? Object.freeze({ kind: 'workspace', organizationId, workspaceId })
                  : Object.freeze({ kind: 'self', userId: subject.userId });
            return Object.freeze({
                organization: Object.freeze({ ...membership }),
                canManageOrganizationMembers,
                canEditRoleDefinitions: ownerOrAdministrator && grants[1].allowed,
                canInvite: ownerOrAdministrator && grants[2].allowed,
                memberVisibility,
            });
        });
    }

    readWorkspace(input: WorkspaceGovernanceInput): Promise<WorkspaceGovernanceSnapshot> {
        return this.read(async () => {
            const { subject, organizationId, workspaceId } = input;
            const target = { kind: 'workspace' as const, organizationId, workspaceId };
            const context = await this.authorization.require({
                subject,
                permissionCode: op.read,
                target: { kind: 'organization', organizationId },
            });
            await this.authorization.require({ subject, permissionCode: wp.read, target });
            const grants = await this.permission.evaluateMany([
                { subject, permissionCode: wp.members, scope: target },
                { subject, permissionCode: wp.update, scope: target },
                { subject, permissionCode: wp.audit, scope: target },
                {
                    subject,
                    permissionCode: op.members,
                    scope: { kind: 'organization', organizationId },
                },
            ]);
            const canManageOrganizationMembers =
                (context.organization.isOwner || context.organization.isSuperAdmin) &&
                grants[3].allowed;
            return Object.freeze({
                userId: subject.userId,
                isSuperAdmin: context.organization.isSuperAdmin,
                canManageOrganizationMembers,
                canViewMembers: grants[0].allowed || canManageOrganizationMembers,
                canUpdate: grants[1].allowed,
                canReadActivity: grants[2].allowed,
            });
        });
    }

    requireOrganizationOwner(
        input: OrganizationGovernanceInput & {
            readonly permissionCode: OrganizationGovernancePermission;
        }
    ): Promise<void> {
        return this.read(async () => {
            const { subject, organizationId, permissionCode } = input;
            const target = { kind: 'organization' as const, organizationId };
            if (permissionCode !== op.read)
                await this.authorization.require({ subject, permissionCode: op.read, target });
            const context = await this.authorization.require({ subject, permissionCode, target });
            if (!context.organization.isOwner && !context.organization.isSuperAdmin)
                throw new TeamGovernanceError({ reason: 'forbidden' });
        });
    }

    requireOrganizationMemberManagement(input: OrganizationGovernanceInput): Promise<void> {
        return this.read(async () => {
            await this.requireManagement({
                subject: input.subject,
                organizationId: input.organizationId,
            });
        });
    }

    requireWorkspaceMemberManagement(
        input: WorkspaceGovernanceInput
    ): Promise<'organization' | 'workspace'> {
        return this.read(() => this.requireManagement(input));
    }

    private async requireManagement(
        input: TeamGovernanceInput
    ): Promise<'organization' | 'workspace'> {
        const { subject, organizationId, workspaceId } = input;
        const target = { kind: 'organization' as const, organizationId };
        const membership = await this.organization.requireAccess(subject.userId, organizationId);
        await this.authorization.require({ subject, permissionCode: op.read, target });
        const organizationManager =
            (membership.isOwner || membership.isSuperAdmin) &&
            (await this.permission.evaluate({ subject, permissionCode: op.members, scope: target }))
                .allowed;
        if (workspaceId) await this.requireWorkspace(organizationId, workspaceId);
        if (organizationManager) return 'organization';
        if (!workspaceId) throw new TeamGovernanceError({ reason: 'forbidden' });
        await this.authorization.require({
            subject,
            permissionCode: wp.members,
            target: { kind: 'workspace', organizationId, workspaceId },
        });
        return 'workspace';
    }

    private async requireWorkspace(organizationId: string, workspaceId: string): Promise<void> {
        const workspace = await this.database.queryClient.workspace.findFirst({
            where: { id: workspaceId, organizationId, archivedAt: null },
            select: { id: true },
        });
        if (!workspace) throw new TeamGovernanceError({ reason: 'forbidden' });
    }

    private read<T>(work: () => Promise<T>): Promise<T> {
        return this.database.transaction.run(
            work,
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }
}
