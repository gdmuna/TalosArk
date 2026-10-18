import { Body, Controller, Get, Param, Post, Patch, Query, Res } from '@nestjs/common';
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
    WorkspaceDetailSchema,
    WorkspaceUpdateSchema,
    ManagementActivityQuerySchema,
    ManagementActivityPageSchema,
    type WorkspaceUpdate,
    type ManagementActivityQuery,
} from '@talos-ark/contracts/team';
import { WorkspaceService } from '../application/workspace.service.js';
import { WorkspaceManagementService } from '../application/workspace-management.service.js';

@Controller('organization/:organizationId/workspace')
export class WorkspaceController {
    constructor(
        private readonly workspace: WorkspaceService,
        private readonly management: WorkspaceManagementService
    ) {}

    @Get(':workspaceId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read workspace management details',
        request: { params: WorkspaceContextParamsSchema },
        responses: [{ status: 200, schema: WorkspaceDetailSchema }],
        errors: Object.values(TeamErrorDefinition),
    })
    detail(
        @Param() params: WorkspaceContextParams,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.management.detail(params.organizationId, params.workspaceId);
    }

    @Patch(':workspaceId')
    @ApiRoute({
        auth: 'required',
        summary: 'Update workspace details with revision checking',
        request: { params: WorkspaceContextParamsSchema, body: WorkspaceUpdateSchema },
        responses: [{ status: 204 }],
        errors: Object.values(TeamErrorDefinition),
    })
    update(@Param() params: WorkspaceContextParams, @Body() input: WorkspaceUpdate) {
        return this.management.update(params.organizationId, params.workspaceId, input);
    }

    @Get(':workspaceId/activity')
    @ApiRoute({
        auth: 'required',
        summary: 'Read safe workspace management activity',
        request: { params: WorkspaceContextParamsSchema, query: ManagementActivityQuerySchema },
        responses: [{ status: 200, schema: ManagementActivityPageSchema }],
        errors: Object.values(TeamErrorDefinition),
    })
    activity(
        @Param() params: WorkspaceContextParams,
        @Query() query: ManagementActivityQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.management.activity(params.organizationId, params.workspaceId, query);
    }

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
