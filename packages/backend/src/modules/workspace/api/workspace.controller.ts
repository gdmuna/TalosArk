import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import {
    CreateWorkspaceBodySchema,
    OrganizationParamsSchema,
    WorkspaceContextParamsSchema,
    WorkspaceSummarySchema,
    type CreateWorkspaceBody,
    type OrganizationParams,
    type WorkspaceContextParams,
} from '@talos-ark/contracts/team';
import { WorkspaceService } from '../application/workspace.service.js';

@Controller('organization/:organizationId/workspace')
export class WorkspaceController {
    constructor(private readonly workspace: WorkspaceService) {}

    @Post()
    @ApiRoute({
        auth: 'required',
        summary: 'Create a workspace with its initial membership',
        request: { params: OrganizationParamsSchema, body: CreateWorkspaceBodySchema },
        responses: [{ status: 201, schema: WorkspaceSummarySchema }],
        errors: [TeamErrorDefinition.forbidden],
    })
    create(
        @Param() params: OrganizationParams,
        @Body() input: CreateWorkspaceBody,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.workspace.create(params.organizationId, input);
    }

    @Get(':workspaceId/context')
    @ApiRoute({
        auth: 'required',
        summary: 'Validate the current organization and workspace context',
        request: { params: WorkspaceContextParamsSchema },
        responses: [{ status: 200, schema: WorkspaceSummarySchema }],
        errors: [TeamErrorDefinition.forbidden],
    })
    context(
        @Param() params: WorkspaceContextParams,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.workspace.readContext(params.organizationId, params.workspaceId);
    }
}
