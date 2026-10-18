import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { AllConfig } from '@/config/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { organizationPermission as op } from '@/core/team-governance/index.js';
import { OrganizationTeamService } from './team.service.js';
import { TeamOperations } from './team.operations.js';
import { TeamError } from './team.error.js';
import { InvitationDelivery, invitationHash, type InvitationMail } from './invitation.delivery.js';

@Injectable()
export class OrganizationInvitationService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly team: OrganizationTeamService,
        private readonly operations: TeamOperations,
        private readonly delivery: InvitationDelivery,
        private readonly authorization: AuthorizationKernel,
        private readonly config: ConfigService<AllConfig, true>
    ) {}

    async issue(
        organizationId: string,
        input: { email?: string; id?: string; workspaceId?: string }
    ) {
        let delivery: 'queued' | 'unavailable' = 'unavailable';
        await this.operations.write(organizationId, async () => {
            await this.team.owner(organizationId, op.invitations);
            const previous = input.id
                ? await this.database.queryClient.organizationInvitation.findFirst({
                      where: { id: input.id, organizationId },
                      select: {
                          id: true,
                          email: true,
                          workspaceId: true,
                          acceptedAt: true,
                          revokedAt: true,
                      },
                  })
                : null;
            if (input.id && (!previous || previous.acceptedAt || previous.revokedAt))
                throw new TeamError({ reason: 'invitation-invalid' });
            const email = previous?.email ?? input.email;
            const workspaceId = previous?.workspaceId ?? input.workspaceId;
            if (!email) throw new TeamError({ reason: 'account-unavailable' });
            const user = await this.database.queryClient.user.findUnique({
                where: { email },
                select: { id: true },
            });
            if (!user) throw new TeamError({ reason: 'account-unavailable' });
            if (
                workspaceId &&
                !(await this.database.queryClient.workspace.findFirst({
                    where: { id: workspaceId, organizationId, archivedAt: null },
                    select: { id: true },
                }))
            )
                throw new TeamError({ reason: 'forbidden' });
            const membership = await this.database.queryClient.organizationMember.findUnique({
                where: { organizationId_userId: { organizationId, userId: user.id } },
                select: { id: true, status: true },
            });
            if (membership?.status === 'SUSPENDED') throw new TeamError({ reason: 'conflict' });
            if (membership?.status === 'ACTIVE') {
                if (
                    !workspaceId ||
                    (await this.database.queryClient.workspaceMember.findFirst({
                        where: {
                            organizationId,
                            workspaceId,
                            organizationMemberId: membership.id,
                            status: 'ACTIVE',
                        },
                        select: { id: true },
                    }))
                )
                    throw new TeamError({ reason: 'conflict' });
            }
            const token = randomBytes(32).toString('base64url');
            const now = new Date();
            const expiresAt = new Date(
                now.getTime() + this.config.get('team.invitationTtlSeconds', { infer: true }) * 1000
            );
            // A fresh invitation supersedes all unconsumed invitations to the same target scope.
            await this.database.queryClient.organizationInvitation.updateMany({
                where: {
                    organizationId,
                    email,
                    workspaceId: workspaceId ?? null,
                    acceptedAt: null,
                    revokedAt: null,
                    ...(previous ? { id: { not: previous.id } } : {}),
                },
                data: { revokedAt: now },
            });
            const invitation = previous
                ? await this.database.queryClient.organizationInvitation.update({
                      where: { id: previous.id },
                      data: {
                          tokenHash: invitationHash(token),
                          expiresAt,
                          invitedById: this.operations.actor(),
                      },
                      select: { id: true },
                  })
                : await this.database.queryClient.organizationInvitation.create({
                      data: {
                          organizationId,
                          workspaceId,
                          email,
                          tokenHash: invitationHash(token),
                          expiresAt,
                          invitedById: this.operations.actor(),
                      },
                      select: { id: true },
                  });
            await this.operations.record(
                organizationId,
                previous ? 'invitation.resend' : 'invitation.create',
                { invitationId: invitation.id },
                workspaceId ?? undefined
            );
            const organization = await this.database.queryClient.organization.findUniqueOrThrow({
                where: { id: organizationId },
                select: { name: true },
            });
            const mail: InvitationMail = {
                id: invitation.id,
                email,
                token,
                organizationName: organization.name,
            };
            this.database.transaction.afterCommit(() => {
                delivery = this.delivery.enqueue(mail) ? 'queued' : 'unavailable';
            });
        });
        return { delivery };
    }

    revoke(organizationId: string, id: string): Promise<void> {
        return this.operations.write(organizationId, async () => {
            await this.team.owner(organizationId, op.invitations);
            const result = await this.database.queryClient.organizationInvitation.updateMany({
                where: { id, organizationId, acceptedAt: null, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            if (result.count)
                await this.operations.record(organizationId, 'invitation.revoke', {
                    invitationId: id,
                });
        });
    }

    private async valid(token: string) {
        const invitation = await this.database.queryClient.organizationInvitation.findUnique({
            where: { tokenHash: invitationHash(token) },
            include: {
                organization: { select: { name: true, ownerUserId: true, archivedAt: true } },
                workspace: { select: { name: true, archivedAt: true } },
            },
        });
        const user = await this.database.queryClient.user.findUnique({
            where: { id: this.operations.actor() },
            select: { id: true, email: true },
        });
        if (
            !invitation ||
            !user ||
            invitation.email !== user.email ||
            invitation.acceptedAt ||
            invitation.revokedAt ||
            invitation.expiresAt <= new Date() ||
            invitation.organization.archivedAt ||
            invitation.workspace?.archivedAt ||
            invitation.invitedById !== invitation.organization.ownerUserId
        )
            throw new TeamError({ reason: 'invitation-invalid' });
        const authority = await this.authorization.check({
            subject: { kind: 'user', userId: invitation.invitedById },
            permissionCode: op.invitations,
            target: { kind: 'organization', organizationId: invitation.organizationId },
        });
        if (!authority.allowed) throw new TeamError({ reason: 'invitation-invalid' });
        return { invitation, user };
    }

    preview(token: string) {
        return this.database.transaction.run(
            async () => {
                const { invitation } = await this.valid(token);
                return {
                    organizationName: invitation.organization.name,
                    workspaceName: invitation.workspace?.name ?? null,
                    email: invitation.email,
                    expiresAt: invitation.expiresAt.toISOString(),
                };
            },
            { isolationLevel: 'RepeatableRead' }
        );
    }

    async accept(token: string) {
        const observed = await this.valid(token);
        const organizationId = observed.invitation.organizationId;
        return this.operations.write(
            organizationId,
            async () => {
                const { invitation, user } = await this.valid(token);
                const current = await this.database.queryClient.organizationMember.findUnique({
                    where: { organizationId_userId: { organizationId, userId: user.id } },
                    select: { id: true, status: true },
                });
                if (current?.status === 'SUSPENDED')
                    throw new TeamError({ reason: 'invitation-invalid' });
                if (current && current.status !== 'ACTIVE') {
                    const children = await this.database.queryClient.workspaceMember.findMany({
                        where: { organizationMemberId: current.id },
                        select: { id: true },
                    });
                    await this.database.queryClient.workspaceRoleBinding.deleteMany({
                        where: { workspaceMemberId: { in: children.map((item) => item.id) } },
                    });
                    await this.database.queryClient.workspaceMember.updateMany({
                        where: { organizationMemberId: current.id },
                        data: { status: 'LEFT' },
                    });
                    await this.database.queryClient.organizationRoleBinding.deleteMany({
                        where: { organizationMemberId: current.id },
                    });
                }
                const member =
                    current?.status === 'ACTIVE'
                        ? current
                        : await this.database.queryClient.organizationMember.upsert({
                              where: { organizationId_userId: { organizationId, userId: user.id } },
                              create: { organizationId, userId: user.id },
                              update: { status: 'ACTIVE', joinedAt: new Date(), leftAt: null },
                              select: { id: true },
                          });
                if (current?.status !== 'ACTIVE')
                    await this.team.bindBasicRole(organizationId, member.id);
                if (invitation.workspaceId)
                    await this.team.joinWorkspace(
                        organizationId,
                        invitation.workspaceId,
                        member.id
                    );
                const consumed = await this.database.queryClient.organizationInvitation.updateMany({
                    where: {
                        id: invitation.id,
                        tokenHash: invitationHash(token),
                        acceptedAt: null,
                        revokedAt: null,
                        expiresAt: { gt: new Date() },
                    },
                    data: { acceptedAt: new Date(), acceptedById: user.id },
                });
                if (consumed.count !== 1) throw new TeamError({ reason: 'invitation-invalid' });
                await this.operations.record(
                    organizationId,
                    'invitation.accept',
                    { invitationId: invitation.id, memberId: member.id },
                    invitation.workspaceId ?? undefined
                );
                return { organizationId, workspaceId: invitation.workspaceId };
            },
            true
        );
    }
}
