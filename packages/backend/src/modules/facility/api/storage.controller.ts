import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
    StorageParamsSchema,
    StorageNodeParamsSchema,
    FacilityReadQuerySchema,
    StorageQuerySchema,
    StorageNodeCreateSchema,
    StorageNodeUpdateSchema,
    StorageNodeStateSchema,
    StorageNodeMoveSchema,
    StorageNodeReorderSchema,
    StorageGridSchema,
    StorageNodeDetailSchema,
    StorageNodePageSchema,
    StorageMutationSchema,
    StorageMoveResultSchema,
    type StorageParams,
    type StorageNodeParams,
    type StorageQuery,
    type StorageNodeCreate,
    type StorageNodeUpdate,
    type StorageNodeState,
    type StorageNodeMove,
    type StorageNodeReorder,
    type StorageGrid,
} from '@talos-ark/contracts/facility';
import { FacilityErrorDefinition, TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { StorageStructureService } from '../application/storage-structure.service.js';

const errors = [...Object.values(FacilityErrorDefinition), TeamErrorDefinition.forbidden];
@Controller('organization/:organizationId/facility/:facilityId/topology/:topologyId/node')
export class StorageController {
    constructor(private readonly storage: StorageStructureService) {}
    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'Browse, search or select usable storage positions',
        request: { params: StorageParamsSchema, query: StorageQuerySchema },
        responses: [{ status: 200, schema: StorageNodePageSchema }],
        errors,
    })
    list(
        @Param() params: StorageParams,
        @Query() query: StorageQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.storage.list({ ...params, workspaceId: query.workspaceId }, query);
    }
    @Get(':nodeId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read a storage node and its path',
        request: { params: StorageNodeParamsSchema, query: FacilityReadQuerySchema },
        responses: [{ status: 200, schema: StorageNodeDetailSchema }],
        errors,
    })
    detail(
        @Param() params: StorageNodeParams,
        @Query() query: { workspaceId?: string },
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.storage.detail({ ...params, workspaceId: query.workspaceId });
    }
    @Post()
    @ApiRoute({
        auth: 'required',
        summary: 'Create a container or position',
        request: { params: StorageParamsSchema, body: StorageNodeCreateSchema },
        responses: [{ status: 201, schema: StorageNodeDetailSchema }],
        errors,
    })
    create(@Param() params: StorageParams, @Body() body: StorageNodeCreate) {
        return this.storage.create(params, body);
    }
    @Patch(':nodeId')
    @ApiRoute({
        auth: 'required',
        summary: 'Edit storage node details',
        request: { params: StorageNodeParamsSchema, body: StorageNodeUpdateSchema },
        responses: [{ status: 200, schema: StorageNodeDetailSchema }],
        errors,
    })
    update(@Param() params: StorageNodeParams, @Body() body: StorageNodeUpdate) {
        return this.storage.update(params, body);
    }
    @Post(':nodeId/state')
    @ApiRoute({
        auth: 'required',
        summary: 'Disable, archive or restore a storage node',
        request: { params: StorageNodeParamsSchema, body: StorageNodeStateSchema },
        responses: [{ status: 201, schema: StorageMutationSchema }],
        errors,
    })
    state(@Param() params: StorageNodeParams, @Body() body: StorageNodeState) {
        return this.storage.state(params, body);
    }
    @Post(':nodeId/move')
    @ApiRoute({
        auth: 'required',
        summary: 'Move an empty subtree within or between facilities',
        request: { params: StorageNodeParamsSchema, body: StorageNodeMoveSchema },
        responses: [{ status: 201, schema: StorageMoveResultSchema }],
        errors,
    })
    move(@Param() params: StorageNodeParams, @Body() body: StorageNodeMove) {
        return this.storage.move(params, body);
    }
    @Post(':nodeId/reorder')
    @ApiRoute({
        auth: 'required',
        summary: 'Reorder a node relative to a sibling',
        request: { params: StorageNodeParamsSchema, body: StorageNodeReorderSchema },
        responses: [{ status: 201, schema: StorageMutationSchema }],
        errors,
    })
    reorder(@Param() params: StorageNodeParams, @Body() body: StorageNodeReorder) {
        return this.storage.reorder(params, body);
    }
    @Post(':nodeId/grid')
    @ApiRoute({
        auth: 'required',
        summary: 'Atomically generate bounded grid positions',
        request: { params: StorageNodeParamsSchema, body: StorageGridSchema },
        responses: [{ status: 201, schema: StorageMutationSchema }],
        errors,
    })
    grid(@Param() params: StorageNodeParams, @Body() body: StorageGrid) {
        return this.storage.grid(params, body);
    }
}
