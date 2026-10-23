import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CreateWorkspaceBodySchema, TeamRoleBodySchema } from '@talos-ark/contracts/team';
import { DatabaseRuntime } from '../../../src/infra/database/database.runtime.js';
import { WorkspaceService } from '../../../src/modules/workspace/application/workspace.service.js';
import { OrganizationTeamService } from '../../../src/modules/organization/application/team.service.js';
import { OrganizationInvitationService } from '../../../src/modules/organization/application/invitation.service.js';
import { AuthorizationKernel } from '../../../src/core/authorization/index.js';
import { SeedSecrets } from '../seed.secret.js';
import { extraWorkspaceKind, teamKind, workspaceMembershipKind } from './governance.kind.js';
import { scopeReferenceSchema } from './seed.kind.js';
import type { BusinessSeeder } from '../seed.definition.js';
import type { SeedExecution } from '../seed.execution.js';

@Injectable()
export class ExtraWorkspaceSeeder implements BusinessSeeder<typeof extraWorkspaceKind> {
    constructor(
        private readonly workspaces: WorkspaceService,
        private readonly database: DatabaseRuntime
    ) {}
    seed(
        data: z.output<typeof extraWorkspaceKind.data>,
        scope: z.output<typeof extraWorkspaceKind.input>,
        execution: SeedExecution
    ) {
        return execution.record({
            key: 'workspace',
            output: scopeReferenceSchema,
            create: async () => {
                const request = { ...data } satisfies z.input<typeof CreateWorkspaceBodySchema>;
                const workspace = await this.workspaces.create(
                    scope.organizationId,
                    CreateWorkspaceBodySchema.parse(request)
                );
                return { ...scope, workspaceId: workspace.id };
            },
            inspect: (value) =>
                this.database.queryClient.workspace.findUniqueOrThrow({
                    where: { id: value.workspaceId },
                    select: {
                        id: true,
                        organizationId: true,
                        name: true,
                        description: true,
                        archivedAt: true,
                    },
                }),
        });
    }
}

@Injectable()
export class TeamSeeder implements BusinessSeeder<typeof teamKind> {
    constructor(
        private readonly team: OrganizationTeamService,
        private readonly invitations: OrganizationInvitationService,
        private readonly database: DatabaseRuntime,
        private readonly secrets: SeedSecrets,
        private readonly authorization: AuthorizationKernel
    ) {}

    async seed(
        data: z.output<typeof teamKind.data>,
        input: z.output<typeof teamKind.input>,
        execution: SeedExecution
    ) {
        const { scope, accounts } = input;
        const org = scope.organizationId;
        const roles: Record<string, string> = {};
        const members: Record<string, string> = {};
        const invitations: Record<string, string> = {};
        const account = (key: string) => {
            const value = accounts[key];
            if (!value?.active) throw new Error(`Missing active seed account ${key}`);
            return value;
        };
        await execution.record({
            key: 'initialize',
            output: z.uuid(),
            create: async () => {
                await this.team.initialize(org);
                return org;
            },
            inspect: (id) =>
                this.database.queryClient.role.findMany({
                    where: { organizationId: id, code: 'organization-governance' },
                    select: { id: true, code: true },
                    orderBy: { id: 'asc' },
                }),
        });
        for (const role of data.roles) {
            roles[role.key] = await execution.record({
                key: `role/${role.key}`,
                output: z.uuid(),
                create: async () => {
                    const request = { ...role.input } satisfies z.input<typeof TeamRoleBodySchema>;
                    await this.team.createRole(org, TeamRoleBodySchema.parse(request));
                    const found = await this.database.queryClient.role.findUniqueOrThrow({
                        where: {
                            organizationId_scope_code: {
                                organizationId: org,
                                scope: role.input.scope,
                                code: role.input.code,
                            },
                        },
                        select: { id: true },
                    });
                    if (role.archived) await this.team.updateRole(org, found.id, null);
                    return found.id;
                },
                inspect: (id) =>
                    this.database.queryClient.role.findUniqueOrThrow({
                        where: { id },
                        select: {
                            id: true,
                            organizationId: true,
                            code: true,
                            name: true,
                            scope: true,
                            archivedAt: true,
                            permissions: {
                                select: { permissionCode: true },
                                orderBy: { permissionCode: 'asc' },
                            },
                        },
                    }),
            });
        }
        const invite = async (key: string, email: string, workspace: boolean) =>
            execution.record({
                key: `invitation/${key}`,
                output: z.uuid(),
                create: async () => {
                    await this.invitations.issue(org, {
                        email,
                        ...(workspace ? { workspaceId: scope.workspaceId } : {}),
                    });
                    return (
                        await this.database.queryClient.organizationInvitation.findFirstOrThrow({
                            where: {
                                organizationId: org,
                                email,
                                workspaceId: workspace ? scope.workspaceId : null,
                                acceptedAt: null,
                                revokedAt: null,
                            },
                            select: { id: true },
                            orderBy: { createdAt: 'desc' },
                        })
                    ).id;
                },
                inspect: (id) =>
                    this.database.queryClient.organizationInvitation.findUniqueOrThrow({
                        where: { id },
                        select: {
                            id: true,
                            organizationId: true,
                            workspaceId: true,
                            email: true,
                            invitedById: true,
                            acceptedById: true,
                            acceptedAt: true,
                            revokedAt: true,
                            expiresAt: true,
                        },
                    }),
            });
        const accept = async (key: string, invitationId: string, userId: string) =>
            execution.asActor(userId, () =>
                execution.record({
                    key: `accept/${key}`,
                    output: z.uuid(),
                    create: async () => {
                        await this.invitations.accept(this.secrets.invitation(invitationId));
                        return (
                            await this.database.queryClient.organizationMember.findUniqueOrThrow({
                                where: { organizationId_userId: { organizationId: org, userId } },
                                select: { id: true },
                            })
                        ).id;
                    },
                    inspect: (id) =>
                        this.database.queryClient.organizationMember.findUniqueOrThrow({
                            where: { id },
                            select: {
                                id: true,
                                organizationId: true,
                                userId: true,
                                status: true,
                                leftAt: true,
                            },
                        }),
                })
            );
        for (const member of data.members) {
            const user = account(member.account);
            const invitationId = await invite(member.account, user.email, member.workspace);
            invitations[member.account] = invitationId;
            members[member.account] = await accept(member.account, invitationId, user.userId);
            if (member.lifecycle !== 'active') {
                await execution.record({
                    key: `leave/${member.account}`,
                    output: z.uuid(),
                    create: async () => {
                        await this.team.removeMember(org, members[member.account]);
                        return members[member.account];
                    },
                    inspect: (id) =>
                        this.database.queryClient.organizationMember.findUniqueOrThrow({
                            where: { id },
                            select: { id: true, status: true, leftAt: true },
                        }),
                });
                if (member.lifecycle === 'rejoined') {
                    const fresh = await invite(
                        `${member.account}-rejoin`,
                        user.email,
                        member.workspace
                    );
                    await accept(`${member.account}-rejoin`, fresh, user.userId);
                }
            }
            if (member.lifecycle === 'left') continue;
            for (const roleScope of ['ORGANIZATION', 'WORKSPACE'] as const) {
                const selected = data.roles.filter(
                    (role) => member.roles.includes(role.key) && role.input.scope === roleScope
                );
                if (!selected.length) continue;
                if (roleScope === 'WORKSPACE' && !member.workspace)
                    throw new Error(
                        'Cannot assign workspace roles to an organization-only fixture'
                    );
                await execution.record({
                    key: `bindings/${member.account}/${roleScope}`,
                    output: z.uuid(),
                    create: async () => {
                        const workspaceId =
                            roleScope === 'WORKSPACE' ? scope.workspaceId : undefined;
                        const target = workspaceId
                            ? await this.database.queryClient.workspaceMember.findUniqueOrThrow({
                                  where: {
                                      workspaceId_organizationMemberId: {
                                          workspaceId,
                                          organizationMemberId: members[member.account],
                                      },
                                  },
                                  select: { id: true },
                              })
                            : { id: members[member.account] };
                        const basic = await this.database.queryClient.role.findUniqueOrThrow({
                            where: {
                                organizationId_scope_code: {
                                    organizationId: org,
                                    scope: roleScope,
                                    code: workspaceId ? 'workspace-member' : 'organization-member',
                                },
                            },
                            select: { id: true },
                        });
                        await this.team.setBindings(
                            org,
                            target.id,
                            [basic.id, ...selected.map((role) => roles[role.key])],
                            workspaceId
                        );
                        return target.id;
                    },
                    inspect: (id) =>
                        roleScope === 'WORKSPACE'
                            ? this.database.queryClient.workspaceRoleBinding.findMany({
                                  where: { workspaceMemberId: id },
                                  select: { roleId: true },
                                  orderBy: { roleId: 'asc' },
                              })
                            : this.database.queryClient.organizationRoleBinding.findMany({
                                  where: { organizationMemberId: id },
                                  select: { roleId: true },
                                  orderBy: { roleId: 'asc' },
                              }),
                });
            }
        }
        for (const item of data.invitations) {
            const id = await invite(item.key, account(item.account).email, item.workspace);
            invitations[item.key] = id;
            if (item.state !== 'pending')
                await execution.record({
                    key: `${item.state}/${item.key}`,
                    output: z.uuid(),
                    create: async () => {
                        if (item.state === 'revoked') await this.invitations.revoke(org, id);
                        else await this.invitations.issue(org, { id });
                        return id;
                    },
                    inspect: (value) =>
                        this.database.queryClient.organizationInvitation.findUniqueOrThrow({
                            where: { id: value },
                            select: {
                                id: true,
                                tokenHash: true,
                                revokedAt: true,
                                acceptedAt: true,
                                expiresAt: true,
                            },
                        }),
                });
        }
        await execution.record({
            key: 'authorization-expectations',
            output: z.boolean(),
            create: async () => true,
            inspect: async () => {
                const decisions = [];
                for (const check of data.checks) {
                    const decision = await this.authorization.check({
                        subject: { kind: 'user', userId: account(check.account).userId },
                        permissionCode: check.permissionCode,
                        target: {
                            kind: 'workspace',
                            organizationId: org,
                            workspaceId: scope.workspaceId,
                        },
                    });
                    if (decision.allowed !== check.allowed)
                        throw new Error(
                            `Authorization fixture mismatch: ${check.account} / ${check.permissionCode}`
                        );
                    decisions.push({ ...check, allowed: decision.allowed });
                }
                return decisions;
            },
        });
        return { scope, roles, members, invitations };
    }
}

@Injectable()
export class WorkspaceMembershipSeeder implements BusinessSeeder<typeof workspaceMembershipKind> {
    constructor(
        private readonly team: OrganizationTeamService,
        private readonly database: DatabaseRuntime
    ) {}
    async seed(
        data: z.output<typeof workspaceMembershipKind.data>,
        input: z.output<typeof workspaceMembershipKind.input>,
        execution: SeedExecution
    ) {
        const { scope } = input;
        if (scope.organizationId !== input.team.scope.organizationId)
            throw new Error('Workspace membership roles belong to another organization');
        const output: z.output<typeof workspaceMembershipKind.output> = {};
        const snapshot = (id: string) =>
            this.database.queryClient.workspaceMember.findUniqueOrThrow({
                where: { id },
                select: {
                    id: true,
                    organizationId: true,
                    workspaceId: true,
                    organizationMemberId: true,
                    status: true,
                    leftAt: true,
                    roleBindings: { select: { roleId: true }, orderBy: { roleId: 'asc' } },
                },
            });
        for (const item of data.members) {
            const account = input.accounts[item.account];
            if (!account?.active || item.roles.some((key) => !input.team.roles[key]))
                throw new Error('Unknown membership account or role');
            const id = await execution.record({
                key: `join/${item.account}`,
                output: z.uuid(),
                create: async () => {
                    await this.team.addMember(
                        scope.organizationId,
                        scope.workspaceId,
                        account.email
                    );
                    const member = await this.database.queryClient.workspaceMember.findFirstOrThrow(
                        {
                            where: {
                                workspaceId: scope.workspaceId,
                                organizationMember: { userId: account.userId },
                            },
                            select: { id: true },
                        }
                    );
                    if (item.roles.length) {
                        const basic = await this.database.queryClient.role.findUniqueOrThrow({
                            where: {
                                organizationId_scope_code: {
                                    organizationId: scope.organizationId,
                                    scope: 'WORKSPACE',
                                    code: 'workspace-member',
                                },
                            },
                            select: { id: true },
                        });
                        await this.team.setBindings(
                            scope.organizationId,
                            member.id,
                            [basic.id, ...item.roles.map((key) => input.team.roles[key])],
                            scope.workspaceId
                        );
                    }
                    return member.id;
                },
                inspect: snapshot,
            });
            if (item.leave)
                await execution.record({
                    key: `leave/${item.account}`,
                    output: z.uuid(),
                    create: async () => {
                        await this.team.removeMember(scope.organizationId, id, scope.workspaceId);
                        return id;
                    },
                    inspect: snapshot,
                });
            output[item.account] = id;
        }
        return output;
    }
}
