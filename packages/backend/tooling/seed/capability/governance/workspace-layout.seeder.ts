import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CreateWorkspaceBodySchema } from '@talos-ark/contracts/team';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import { WorkspaceService } from '../../../../src/modules/workspace/application/workspace.service.js';
import { extraWorkspaceKind } from './governance.kind.js';
import { scopeReferenceSchema } from '../../definition/reference.js';
import { type BusinessSeeder } from '../../runtime/handler.js';
import type { SeedExecution } from '../../runtime/execution.js';

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
