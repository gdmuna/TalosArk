import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
    FacilityScopeSchema,
    FacilityParamsSchema,
    FacilityReadQuerySchema,
    FacilityQuerySchema,
    FacilityWriteSchema,
    FacilityUpdateSchema,
    FacilityStateSchema,
    FacilityGrantSchema,
    FacilitySchema,
    FacilityDetailSchema,
    FacilityPageSchema,
    StorageMutationSchema,
    FacilityGovernanceSchema,
    FacilityInitializeSchema,
    type FacilityScope,
    type FacilityParams,
    type FacilityQuery,
    type FacilityWrite,
    type FacilityUpdate,
    type FacilityState,
    type FacilityGrant,
} from '@talos-ark/contracts/facility';
import { FacilityErrorDefinition, TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { FacilityService } from '../application/facility.service.js';

const errors = [...Object.values(FacilityErrorDefinition), TeamErrorDefinition.forbidden];
@Controller('organization/:organizationId/facility')
export class FacilityController {
    constructor(private readonly facilities: FacilityService) {}
    @Get('context')
    @ApiRoute({
        auth: 'required',
        summary: 'Read facility governance capabilities',
        request: { params: FacilityScopeSchema },
        responses: [{ status: 200, schema: FacilityGovernanceSchema }],
        errors,
    })
    context(@Param() params: FacilityScope, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.facilities.governance(params.organizationId);
    }
    @Post('initialize')
    @ApiRoute({
        auth: 'required',
        summary: 'Explicitly initialize facility grants for an existing organization owner',
        request: { params: FacilityScopeSchema },
        responses: [{ status: 201, schema: FacilityInitializeSchema }],
        errors,
    })
    initialize(@Param() params: FacilityScope) {
        return this.facilities.initialize(params.organizationId);
    }
    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'List accessible facilities',
        request: { params: FacilityScopeSchema, query: FacilityQuerySchema },
        responses: [{ status: 200, schema: FacilityPageSchema }],
        errors,
    })
    list(
        @Param() params: FacilityScope,
        @Query() query: FacilityQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.facilities.list({ ...params, workspaceId: query.workspaceId }, query);
    }
    @Post()
    @ApiRoute({
        auth: 'required',
        summary: 'Register a facility and its initial layout',
        request: { params: FacilityScopeSchema, body: FacilityWriteSchema },
        responses: [{ status: 201, schema: FacilitySchema }],
        errors,
    })
    create(@Param() params: FacilityScope, @Body() body: FacilityWrite) {
        return this.facilities.create(params.organizationId, body);
    }
    @Get(':facilityId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read a facility',
        request: { params: FacilityParamsSchema, query: FacilityReadQuerySchema },
        responses: [{ status: 200, schema: FacilityDetailSchema }],
        errors,
    })
    detail(
        @Param() params: FacilityParams,
        @Query() query: { workspaceId?: string },
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.facilities.detail(
            { organizationId: params.organizationId, workspaceId: query.workspaceId },
            params.facilityId
        );
    }
    @Patch(':facilityId')
    @ApiRoute({
        auth: 'required',
        summary: 'Update facility governance and details',
        request: { params: FacilityParamsSchema, body: FacilityUpdateSchema },
        responses: [{ status: 200, schema: FacilitySchema }],
        errors,
    })
    update(@Param() params: FacilityParams, @Body() body: FacilityUpdate) {
        return this.facilities.update(params.organizationId, params.facilityId, body);
    }
    @Post(':facilityId/state')
    @ApiRoute({
        auth: 'required',
        summary: 'Disable, archive or restore a facility',
        request: { params: FacilityParamsSchema, body: FacilityStateSchema },
        responses: [{ status: 201, schema: FacilitySchema }],
        errors,
    })
    state(@Param() params: FacilityParams, @Body() body: FacilityState) {
        return this.facilities.state(params.organizationId, params.facilityId, body);
    }
    @Post(':facilityId/access')
    @ApiRoute({
        auth: 'required',
        summary: 'Change whole-facility workspace access',
        request: { params: FacilityParamsSchema, body: FacilityGrantSchema },
        responses: [{ status: 201, schema: StorageMutationSchema }],
        errors,
    })
    grant(@Param() params: FacilityParams, @Body() body: FacilityGrant) {
        return this.facilities.grant(params.organizationId, params.facilityId, body);
    }
}
