import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import {
    OrganizationParamsSchema,
    TeamItemParamsSchema,
    TeamScopeQuerySchema,
    TeamManagementQuerySchema,
    TeamManagementSchema,
    TeamRoleBodySchema,
    TeamRoleUpdateSchema,
    TeamBindingBodySchema,
    TeamEmailBodySchema,
    InvitationDeliverySchema,
    type OrganizationParams,
    type TeamItemParams,
    type TeamManagementQuery,
    type TeamScopeQuery,
    type TeamRoleBody,
    type TeamRoleUpdate,
} from '@talos-ark/contracts/team';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { OrganizationTeamService } from '../application/team.service.js';
import { OrganizationInvitationService } from '../application/invitation.service.js';
import { TeamError } from '../application/team.error.js';

const errors = Object.values(TeamErrorDefinition);

@Controller('organization/:organizationId/team')
export class OrganizationTeamController {
    constructor(
        private readonly team: OrganizationTeamService,
        private readonly invitations: OrganizationInvitationService
    ) {}

    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'Read an authorized paginated team management view',
        request: { params: OrganizationParamsSchema, query: TeamManagementQuerySchema },
        responses: [{ status: 200, schema: TeamManagementSchema }],
        errors,
    })
    snapshot(
        @Param() params: OrganizationParams,
        @Query() query: TeamManagementQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.team.snapshot(params.organizationId, query);
    }

    @Post('initialize')
    @ApiRoute({
        auth: 'required',
        summary: 'Explicitly initialize organization team management once',
        request: { params: OrganizationParamsSchema },
        responses: [{ status: 204 }],
        errors,
    })
    initialize(@Param() params: OrganizationParams) {
        return this.team.initialize(params.organizationId);
    }

    @Post('member')
    @ApiRoute({
        auth: 'required',
        summary: 'Add an effective organization member to a workspace',
        request: {
            params: OrganizationParamsSchema,
            query: TeamScopeQuerySchema,
            body: TeamEmailBodySchema,
        },
        responses: [{ status: 204 }],
        errors,
    })
    add(
        @Param() params: OrganizationParams,
        @Query() query: TeamScopeQuery,
        @Body() body: { email: string }
    ) {
        if (!query.workspaceId) throw new TeamError({ reason: 'forbidden' });
        return this.team.addMember(params.organizationId, query.workspaceId, body.email);
    }

    @Delete('member/:id')
    @ApiRoute({
        auth: 'required',
        summary: 'Remove a member without deleting historical membership',
        request: { params: TeamItemParamsSchema, query: TeamScopeQuerySchema },
        responses: [{ status: 204 }],
        errors,
    })
    remove(@Param() params: TeamItemParams, @Query() query: TeamScopeQuery) {
        return this.team.removeMember(params.organizationId, params.id, query.workspaceId);
    }

    @Post('member/:id/role')
    @ApiRoute({
        auth: 'required',
        summary: 'Replace scoped member bindings without privilege escalation',
        request: {
            params: TeamItemParamsSchema,
            query: TeamScopeQuerySchema,
            body: TeamBindingBodySchema,
        },
        responses: [{ status: 204 }],
        errors,
    })
    bindings(
        @Param() params: TeamItemParams,
        @Query() query: TeamScopeQuery,
        @Body() body: { roleIds: string[] }
    ) {
        return this.team.setBindings(
            params.organizationId,
            params.id,
            body.roleIds,
            query.workspaceId
        );
    }

    @Post('leave')
    @ApiRoute({
        auth: 'required',
        summary: 'Leave an organization or workspace',
        request: { params: OrganizationParamsSchema, query: TeamScopeQuerySchema },
        responses: [{ status: 204 }],
        errors,
    })
    leave(@Param() params: OrganizationParams, @Query() query: TeamScopeQuery) {
        return this.team.leave(params.organizationId, query.workspaceId);
    }

    @Post('role')
    @ApiRoute({
        auth: 'required',
        summary: 'Create an organization-owned scoped role',
        request: { params: OrganizationParamsSchema, body: TeamRoleBodySchema },
        responses: [{ status: 204 }],
        errors,
    })
    createRole(@Param() params: OrganizationParams, @Body() body: TeamRoleBody) {
        return this.team.createRole(params.organizationId, body);
    }

    @Patch('role/:id')
    @ApiRoute({
        auth: 'required',
        summary: 'Update a custom role and its permission set',
        request: { params: TeamItemParamsSchema, body: TeamRoleUpdateSchema },
        responses: [{ status: 204 }],
        errors,
    })
    updateRole(@Param() params: TeamItemParams, @Body() body: TeamRoleUpdate) {
        return this.team.updateRole(params.organizationId, params.id, body);
    }

    @Delete('role/:id')
    @ApiRoute({
        auth: 'required',
        summary: 'Archive a custom role',
        request: { params: TeamItemParamsSchema },
        responses: [{ status: 204 }],
        errors,
    })
    archiveRole(@Param() params: TeamItemParams) {
        return this.team.updateRole(params.organizationId, params.id, null);
    }

    @Post('invitation')
    @ApiRoute({
        auth: 'required',
        summary: 'Invite an existing account through bounded asynchronous mail delivery',
        request: {
            params: OrganizationParamsSchema,
            query: TeamScopeQuerySchema,
            body: TeamEmailBodySchema,
        },
        responses: [{ status: 201, schema: InvitationDeliverySchema }],
        errors,
    })
    invite(
        @Param() params: OrganizationParams,
        @Query() query: TeamScopeQuery,
        @Body() body: { email: string }
    ) {
        return this.invitations.issue(params.organizationId, {
            email: body.email,
            workspaceId: query.workspaceId,
        });
    }

    @Post('invitation/:id/resend')
    @ApiRoute({
        auth: 'required',
        summary: 'Rotate an invitation credential and queue delivery',
        request: { params: TeamItemParamsSchema },
        responses: [{ status: 201, schema: InvitationDeliverySchema }],
        errors,
    })
    resend(@Param() params: TeamItemParams) {
        return this.invitations.issue(params.organizationId, { id: params.id });
    }

    @Delete('invitation/:id')
    @ApiRoute({
        auth: 'required',
        summary: 'Revoke an unconsumed invitation',
        request: { params: TeamItemParamsSchema },
        responses: [{ status: 204 }],
        errors,
    })
    revoke(@Param() params: TeamItemParams) {
        return this.invitations.revoke(params.organizationId, params.id);
    }
}
