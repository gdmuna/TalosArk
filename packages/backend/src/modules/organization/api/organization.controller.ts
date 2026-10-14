import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import {
    CreateOrganizationBodySchema,
    CreateOrganizationResponseSchema,
    OrganizationListResponseSchema,
    TeamSnapshotResponseSchema,
    type CreateOrganizationBody,
} from '@talos-ark/contracts/team';
import { OrganizationService } from '../application/organization.service.js';

@Controller('organization')
export class OrganizationController {
    constructor(private readonly organization: OrganizationService) {}

    @Post()
    @ApiRoute({
        auth: 'required',
        summary: 'Create an organization and its first workspace atomically',
        request: { body: CreateOrganizationBodySchema },
        responses: [{ status: 201, schema: CreateOrganizationResponseSchema }],
        errors: [TeamErrorDefinition.forbidden],
    })
    create(@Body() input: CreateOrganizationBody, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.organization.create(input);
    }

    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'List organizations the current member can read',
        responses: [{ status: 200, schema: OrganizationListResponseSchema }],
        errors: [TeamErrorDefinition.forbidden],
    })
    async list(@Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        const snapshot = await this.organization.snapshot();
        return { organizations: snapshot.organizations };
    }

    @Get('context')
    @ApiRoute({
        auth: 'required',
        summary: 'List accessible organizations and workspaces',
        responses: [{ status: 200, schema: TeamSnapshotResponseSchema }],
        errors: [TeamErrorDefinition.forbidden],
    })
    context(@Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.organization.snapshot();
    }
}
