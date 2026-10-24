import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { DatabaseRuntime } from '../../../src/infra/database/database.runtime.js';
import { OrganizationService } from '../../../src/modules/organization/application/organization.service.js';
import { WorkspaceService } from '../../../src/modules/workspace/application/workspace.service.js';
import { PermissionKernel } from '../../../src/core/permission/index.js';
import { workspaceKind, scopeReferenceSchema } from './seed.kind.js';
import type { SeedExecution } from '../seed.execution.js';
import type { BusinessSeeder } from '../seed.definition.js';
import { CreateOrganizationBodySchema } from '@talos-ark/contracts/team';

@Injectable()
export class WorkspaceSeeder implements BusinessSeeder<typeof workspaceKind> {
    constructor(
        private readonly organizations: OrganizationService,
        private readonly workspaces: WorkspaceService,
        private readonly database: DatabaseRuntime,
        private readonly permission: PermissionKernel
    ) {}

    seed(
        data: z.infer<typeof workspaceKind.data>,
        input: z.infer<typeof workspaceKind.input>,
        execution: SeedExecution
    ) {
        return this.seedScope(data, input, execution);
    }

    private async seedScope(
        data: z.output<typeof workspaceKind.data>,
        input: z.output<typeof workspaceKind.input>,
        execution: SeedExecution
    ) {
        if (input.target)
            await this.workspaces.readContext(
                input.target.organizationId,
                input.target.workspaceId
            );
        return execution.record({
            key: 'scope',
            output: scopeReferenceSchema,
            create: async () => {
                if (input.target) {
                    return { ...input.target, actorUserId: input.actorUserId };
                }
                const request = {
                    name: `${data.name} ${execution.namespace}`.slice(0, 40),
                    workspaceName: data.workspaceName,
                } satisfies z.input<typeof CreateOrganizationBodySchema>;
                const created = await this.organizations.create(
                    CreateOrganizationBodySchema.parse(request)
                );
                return {
                    organizationId: created.organization.id,
                    workspaceId: created.workspace.id,
                    actorUserId: input.actorUserId,
                };
            },
            inspect: async (scope) => {
                const workspace = await this.database.queryClient.workspace.findUniqueOrThrow({
                    where: { id: scope.workspaceId },
                    select: {
                        id: true,
                        organizationId: true,
                        name: true,
                        description: true,
                        archivedAt: true,
                        organization: {
                            select: { id: true, name: true, ownerUserId: true, archivedAt: true },
                        },
                    },
                });
                const definitions = [...this.permission.definitions()].sort((left, right) =>
                    left.code.localeCompare(right.code)
                );
                const decisions = await this.permission.evaluateMany(
                    definitions.map((definition) => ({
                        subject: { kind: 'user' as const, userId: scope.actorUserId },
                        permissionCode: definition.code,
                        scope:
                            definition.scope === 'ORGANIZATION'
                                ? {
                                      kind: 'organization' as const,
                                      organizationId: scope.organizationId,
                                  }
                                : {
                                      kind: 'workspace' as const,
                                      organizationId: scope.organizationId,
                                      workspaceId: scope.workspaceId,
                                  },
                    }))
                );
                return {
                    workspace,
                    grants: definitions.map((definition, index) => ({
                        code: definition.code,
                        allowed: decisions[index].allowed,
                    })),
                };
            },
        });
    }
}
