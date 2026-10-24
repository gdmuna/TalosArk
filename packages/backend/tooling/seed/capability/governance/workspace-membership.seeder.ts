import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import { OrganizationTeamService } from '../../../../src/modules/organization/application/team.service.js';
import { workspaceMembershipKind } from './governance.kind.js';
import { type BusinessSeeder } from '../../runtime/handler.js';
import type { SeedExecution } from '../../runtime/execution.js';

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
