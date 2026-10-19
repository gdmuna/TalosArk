import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
    MaterialAttachmentBeginSchema,
    MaterialAttachmentBindSchema,
    MaterialAttachmentCompleteSchema,
    MaterialAttachmentDownloadSchema,
    MaterialAttachmentPageSchema,
    MaterialAttachmentParamsSchema,
    MaterialAttachmentProgressSchema,
    MaterialAttachmentQuerySchema,
    MaterialAttachmentReferenceParamsSchema,
    MaterialAttachmentSignSchema,
    MaterialAttachmentUploadParamsSchema,
    MaterialAttachmentUploadSchema,
    MaterialAttachmentPresignedRequestSchema,
    type MaterialAttachmentBegin,
    type MaterialAttachmentBind,
    type MaterialAttachmentComplete,
    type MaterialAttachmentParams,
    type MaterialAttachmentQuery,
    type MaterialAttachmentReferenceParams,
    type MaterialAttachmentSign,
    type MaterialAttachmentUploadParams,
} from '@talos-ark/contracts/material';
import {
    MaterialAttachmentErrorDefinition,
    MaterialErrorDefinition,
    TeamErrorDefinition,
} from '@talos-ark/contracts/backend';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { MaterialAttachmentService } from '../application/material-attachment.service.js';

const errors = [
    ...Object.values(MaterialAttachmentErrorDefinition),
    ...Object.values(MaterialErrorDefinition),
    TeamErrorDefinition.forbidden,
];

@Controller('organization/:organizationId/workspace/:workspaceId/material')
export class MaterialAttachmentController {
    constructor(private readonly attachments: MaterialAttachmentService) {}

    @Post(':materialId/attachment/upload')
    @ApiRoute({
        auth: 'required',
        summary: 'Begin a material attachment upload',
        request: { params: MaterialAttachmentParamsSchema, body: MaterialAttachmentBeginSchema },
        responses: [{ status: 201, schema: MaterialAttachmentUploadSchema }],
        errors,
    })
    begin(@Param() params: MaterialAttachmentParams, @Body() body: MaterialAttachmentBegin) {
        return this.attachments.begin(params, body);
    }

    @Post(':materialId/attachment/upload/:sessionId/sign')
    @ApiRoute({
        auth: 'required',
        summary: 'Sign one material attachment upload request',
        request: {
            params: MaterialAttachmentUploadParamsSchema,
            body: MaterialAttachmentSignSchema,
        },
        responses: [{ status: 200, schema: MaterialAttachmentPresignedRequestSchema }],
        errors,
    })
    sign(
        @Param() params: MaterialAttachmentUploadParams,
        @Body() body: MaterialAttachmentSign,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.attachments.sign(params, body);
    }

    @Get(':materialId/attachment/upload/:sessionId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read material attachment upload progress',
        request: { params: MaterialAttachmentUploadParamsSchema },
        responses: [{ status: 200, schema: MaterialAttachmentProgressSchema }],
        errors,
    })
    progress(
        @Param() params: MaterialAttachmentUploadParams,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.attachments.progress(params);
    }

    @Post(':materialId/attachment/upload/:sessionId/complete')
    @ApiRoute({
        auth: 'required',
        summary: 'Complete a material attachment upload',
        request: {
            params: MaterialAttachmentUploadParamsSchema,
            body: MaterialAttachmentCompleteSchema,
        },
        responses: [{ status: 200, schema: MaterialAttachmentUploadSchema }],
        errors,
    })
    complete(
        @Param() params: MaterialAttachmentUploadParams,
        @Body() body: MaterialAttachmentComplete
    ) {
        return this.attachments.complete(params, body);
    }

    @Post(':materialId/attachment/upload/:sessionId/cancel')
    @ApiRoute({
        auth: 'required',
        summary: 'Cancel a material attachment upload',
        request: { params: MaterialAttachmentUploadParamsSchema },
        responses: [{ status: 200, schema: MaterialAttachmentUploadSchema }],
        errors,
    })
    cancel(@Param() params: MaterialAttachmentUploadParams) {
        return this.attachments.cancel(params);
    }

    @Get(':materialId/attachment')
    @ApiRoute({
        auth: 'required',
        summary: 'List attachments bound to a material',
        request: { params: MaterialAttachmentParamsSchema, query: MaterialAttachmentQuerySchema },
        responses: [{ status: 200, schema: MaterialAttachmentPageSchema }],
        errors,
    })
    list(
        @Param() params: MaterialAttachmentParams,
        @Query() query: MaterialAttachmentQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.attachments.list(params, query);
    }

    @Post(':materialId/attachment')
    @ApiRoute({
        auth: 'required',
        summary: 'Bind a verified upload to a material',
        request: { params: MaterialAttachmentParamsSchema, body: MaterialAttachmentBindSchema },
        responses: [{ status: 201, schema: MaterialAttachmentPageSchema.shape.items.element }],
        errors,
    })
    bind(@Param() params: MaterialAttachmentParams, @Body() body: MaterialAttachmentBind) {
        return this.attachments.bind(params, body);
    }

    @Get(':materialId/attachment/:referenceId/download')
    @ApiRoute({
        auth: 'required',
        summary: 'Create a download request for a material attachment',
        request: { params: MaterialAttachmentReferenceParamsSchema },
        responses: [{ status: 200, schema: MaterialAttachmentDownloadSchema }],
        errors,
    })
    download(
        @Param() params: MaterialAttachmentReferenceParams,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.attachments.download(params);
    }

    @Post(':materialId/attachment/:referenceId/unbind')
    @ApiRoute({
        auth: 'required',
        summary: 'Unbind an attachment from a material',
        request: { params: MaterialAttachmentReferenceParamsSchema },
        responses: [{ status: 200, schema: MaterialAttachmentPageSchema.shape.items.element }],
        errors,
    })
    unbind(@Param() params: MaterialAttachmentReferenceParams) {
        return this.attachments.unbind(params);
    }
}
