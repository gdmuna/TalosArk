import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
    MaterialArchiveSchema,
    MaterialDetailSchema,
    MaterialOverviewSchema,
    MaterialPageSchema,
    MaterialParamsSchema,
    MaterialQuerySchema,
    MaterialScopeSchema,
    MaterialTypeListSchema,
    MaterialSchema,
    MaterialTypeParamsSchema,
    MaterialTypeSchema,
    MaterialTypeWriteSchema,
    MaterialWriteSchema,
    type MaterialArchive,
    type MaterialParams,
    type MaterialQuery,
    type MaterialScope,
    type MaterialTypeParams,
    type MaterialTypeWrite,
    type MaterialWrite,
} from '@talos-ark/contracts/material';
import { MaterialErrorDefinition, TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { MaterialService } from '../application/material.service.js';

const errors = [...Object.values(MaterialErrorDefinition), TeamErrorDefinition.forbidden];

@Controller('organization/:organizationId/workspace/:workspaceId/material')
export class MaterialController {
    constructor(private readonly material: MaterialService) {}

    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'List materials in an authorized workspace',
        request: { params: MaterialScopeSchema, query: MaterialQuerySchema },
        responses: [{ status: 200, schema: MaterialPageSchema }],
        errors,
    })
    list(
        @Param() params: MaterialScope,
        @Query() query: MaterialQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.material.list(params, query);
    }

    @Get('overview')
    @ApiRoute({
        auth: 'required',
        summary: 'Read the material overview for an authorized workspace',
        request: { params: MaterialScopeSchema },
        responses: [{ status: 200, schema: MaterialOverviewSchema }],
        errors,
    })
    overview(@Param() params: MaterialScope, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.material.overview(params);
    }

    @Get('type')
    @ApiRoute({
        auth: 'required',
        summary: 'List workspace material classifications',
        request: { params: MaterialScopeSchema },
        responses: [{ status: 200, schema: MaterialTypeListSchema }],
        errors,
    })
    types(@Param() params: MaterialScope, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.material.types(params);
    }

    @Post('type')
    @ApiRoute({
        auth: 'required',
        summary: 'Create a workspace material classification',
        request: { params: MaterialScopeSchema, body: MaterialTypeWriteSchema },
        responses: [{ status: 201, schema: MaterialTypeSchema }],
        errors,
    })
    createType(@Param() params: MaterialScope, @Body() body: MaterialTypeWrite) {
        return this.material.createType(params, body);
    }

    @Patch('type/:typeId')
    @ApiRoute({
        auth: 'required',
        summary: 'Edit a material classification',
        request: { params: MaterialTypeParamsSchema, body: MaterialTypeWriteSchema },
        responses: [{ status: 200, schema: MaterialTypeSchema }],
        errors,
    })
    updateType(@Param() params: MaterialTypeParams, @Body() body: MaterialTypeWrite) {
        return this.material.updateType(params, body);
    }

    @Post('type/:typeId/archive')
    @ApiRoute({
        auth: 'required',
        summary: 'Archive or restore a material classification',
        request: { params: MaterialTypeParamsSchema, body: MaterialArchiveSchema },
        responses: [{ status: 200, schema: MaterialTypeSchema }],
        errors,
    })
    archiveType(@Param() params: MaterialTypeParams, @Body() body: MaterialArchive) {
        return this.material.archiveType(params, body);
    }

    @Post()
    @ApiRoute({
        auth: 'required',
        summary: 'Create a material definition',
        request: { params: MaterialScopeSchema, body: MaterialWriteSchema },
        responses: [{ status: 201, schema: MaterialSchema }],
        errors,
    })
    create(@Param() params: MaterialScope, @Body() body: MaterialWrite) {
        return this.material.create(params, body);
    }

    @Get(':materialId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read a material definition',
        request: { params: MaterialParamsSchema },
        responses: [{ status: 200, schema: MaterialDetailSchema }],
        errors,
    })
    get(@Param() params: MaterialParams, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.material.get(params);
    }

    @Patch(':materialId')
    @ApiRoute({
        auth: 'required',
        summary: 'Update a material definition',
        request: { params: MaterialParamsSchema, body: MaterialWriteSchema },
        responses: [{ status: 200, schema: MaterialSchema }],
        errors,
    })
    update(@Param() params: MaterialParams, @Body() body: MaterialWrite) {
        return this.material.update(params, body);
    }

    @Post(':materialId/archive')
    @ApiRoute({
        auth: 'required',
        summary: 'Archive or restore a material definition',
        request: { params: MaterialParamsSchema, body: MaterialArchiveSchema },
        responses: [{ status: 200, schema: MaterialSchema }],
        errors,
    })
    archive(@Param() params: MaterialParams, @Body() body: MaterialArchive) {
        return this.material.archive(params, body);
    }
}
