import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
    BatchArchiveSchema,
    BatchPageSchema,
    BatchParamsSchema,
    BatchQuerySchema,
    BatchSchema,
    BatchUpdateSchema,
    BatchWriteSchema,
    MaterialParamsSchema,
    type BatchArchive,
    type BatchParams,
    type BatchQuery,
    type BatchUpdate,
    type BatchWrite,
    type MaterialParams,
} from '@talos-ark/contracts/material';
import { MaterialErrorDefinition, TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { MaterialBatchService } from '../application/material-batch.service.js';
const errors = [...Object.values(MaterialErrorDefinition), TeamErrorDefinition.forbidden];
@Controller('organization/:organizationId/workspace/:workspaceId/material/:materialId/batch')
export class MaterialBatchController {
    constructor(private readonly batches: MaterialBatchService) {}
    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'List material source batches',
        request: { params: MaterialParamsSchema, query: BatchQuerySchema },
        responses: [{ status: 200, schema: BatchPageSchema }],
        errors,
    })
    list(
        @Param() p: MaterialParams,
        @Query() q: BatchQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.batches.list(p, p.materialId, q);
    }
    @Get(':batchId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read a material batch',
        request: { params: BatchParamsSchema },
        responses: [{ status: 200, schema: BatchSchema }],
        errors,
    })
    get(@Param() p: BatchParams, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.batches.get(p, p.materialId, p.batchId);
    }
    @Post()
    @ApiRoute({
        auth: 'required',
        summary: 'Create a material batch',
        request: { params: MaterialParamsSchema, body: BatchWriteSchema },
        responses: [{ status: 201, schema: BatchSchema }],
        errors,
    })
    create(@Param() p: MaterialParams, @Body() b: BatchWrite) {
        return this.batches.create(p, p.materialId, b);
    }
    @Patch(':batchId')
    @ApiRoute({
        auth: 'required',
        summary: 'Correct batch metadata without changing registered instances',
        request: { params: BatchParamsSchema, body: BatchUpdateSchema },
        responses: [{ status: 200, schema: BatchSchema }],
        errors,
    })
    update(@Param() p: BatchParams, @Body() b: BatchUpdate) {
        return this.batches.update(p, p.materialId, p.batchId, b);
    }
    @Post(':batchId/archive')
    @ApiRoute({
        auth: 'required',
        summary: 'Archive or restore a material batch',
        request: { params: BatchParamsSchema, body: BatchArchiveSchema },
        responses: [{ status: 201, schema: BatchSchema }],
        errors,
    })
    archive(@Param() p: BatchParams, @Body() b: BatchArchive) {
        return this.batches.archive(p, p.materialId, p.batchId, b);
    }
}
