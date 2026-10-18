import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
    TeamItemParamsSchema,
    OrganizationParamsSchema,
    TeamScopeQuerySchema,
    ManagementPageQuerySchema,
    ManagementRoleQuerySchema,
    ManagementActivityQuerySchema,
    MemberDetailSchema,
    RoleDetailSchema,
    ManagementMemberPageSchema,
    ManagementRolePageSchema,
    MemberWorkspacePageSchema,
    RoleBindingPageSchema,
    ManagementActivityPageSchema,
    type TeamItemParams,
    type OrganizationParams,
    type TeamScopeQuery,
    type ManagementPageQuery,
    type ManagementRoleQuery,
    type ManagementActivityQuery,
} from '@talos-ark/contracts/team';
import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { TeamDetailService } from '../application/team-detail.service.js';

const errors = Object.values(TeamErrorDefinition);

@Controller('organization/:organizationId/team')
export class TeamDetailController {
    constructor(private readonly details: TeamDetailService) {}

    @Get('member')
    @ApiRoute({
        auth: 'required',
        summary: 'Read an authorized member directory',
        request: { params: OrganizationParamsSchema, query: ManagementPageQuerySchema },
        responses: [{ status: 200, schema: ManagementMemberPageSchema }],
        errors,
    })
    members(
        @Param() params: OrganizationParams,
        @Query() query: ManagementPageQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.details.members(params.organizationId, query);
    }

    @Get('member/:id')
    @ApiRoute({
        auth: 'required',
        summary: 'Read an organization membership detail',
        request: { params: TeamItemParamsSchema, query: TeamScopeQuerySchema },
        responses: [{ status: 200, schema: MemberDetailSchema }],
        errors,
    })
    member(
        @Param() params: TeamItemParams,
        @Query() query: TeamScopeQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.details.member(params.organizationId, params.id, query);
    }

    @Get('member/:id/workspace')
    @ApiRoute({
        auth: 'required',
        summary: 'Read authorized membership workspace relations',
        request: { params: TeamItemParamsSchema, query: ManagementPageQuerySchema },
        responses: [{ status: 200, schema: MemberWorkspacePageSchema }],
        errors,
    })
    workspaces(
        @Param() params: TeamItemParams,
        @Query() query: ManagementPageQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.details.memberWorkspaces(params.organizationId, params.id, query);
    }

    @Get('member/:id/activity')
    @ApiRoute({
        auth: 'required',
        summary: 'Read safe membership management activity',
        request: { params: TeamItemParamsSchema, query: ManagementActivityQuerySchema },
        responses: [{ status: 200, schema: ManagementActivityPageSchema }],
        errors,
    })
    memberActivity(
        @Param() params: TeamItemParams,
        @Query() query: ManagementActivityQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.details.memberActivity(params.organizationId, params.id, query);
    }

    @Get('role')
    @ApiRoute({
        auth: 'required',
        summary: 'Read a paginated role directory',
        request: { params: OrganizationParamsSchema, query: ManagementRoleQuerySchema },
        responses: [{ status: 200, schema: ManagementRolePageSchema }],
        errors,
    })
    roles(
        @Param() params: OrganizationParams,
        @Query() query: ManagementRoleQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.details.roles(params.organizationId, query);
    }

    @Get('role/:id')
    @ApiRoute({
        auth: 'required',
        summary: 'Read a role definition and capabilities',
        request: { params: TeamItemParamsSchema, query: TeamScopeQuerySchema },
        responses: [{ status: 200, schema: RoleDetailSchema }],
        errors,
    })
    role(
        @Param() params: TeamItemParams,
        @Query() query: TeamScopeQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.details.role(params.organizationId, params.id, query);
    }

    @Get('role/:id/member')
    @ApiRoute({
        auth: 'required',
        summary: 'Read effective role bindings within the authorized scope',
        request: { params: TeamItemParamsSchema, query: ManagementPageQuerySchema },
        responses: [{ status: 200, schema: RoleBindingPageSchema }],
        errors,
    })
    bindings(
        @Param() params: TeamItemParams,
        @Query() query: ManagementPageQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.details.bindings(params.organizationId, params.id, query);
    }

    @Get('role/:id/activity')
    @ApiRoute({
        auth: 'required',
        summary: 'Read safe role change records',
        request: { params: TeamItemParamsSchema, query: ManagementActivityQuerySchema },
        responses: [{ status: 200, schema: ManagementActivityPageSchema }],
        errors,
    })
    roleActivity(
        @Param() params: TeamItemParams,
        @Query() query: ManagementActivityQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.details.roleActivity(params.organizationId, params.id, query);
    }
}
