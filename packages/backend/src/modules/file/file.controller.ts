import {
    PresignUploadDto,
    ConfirmUploadDto,
    // MultipartInitDto,
    PresignDownloadDto,
    DeleteFilesDto,
    // CopyFileDto,
    // ResumablePartUrlsDto,
    // CompleteMultipartDto,
    // AbortMultipartDto,
} from './file.dto.js';

import { FileKernel } from '@/core/file/index.js';
import { ApiRoute } from '@/platform/http/decorators/index.js';

import {
    Body,
    Controller,
    Delete,
    Get,
    // Head,
    HttpCode,
    HttpStatus,
    NotImplementedException,
    // NotFoundException,
    Param,
    Post,
    Req,
    Res,
    StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type { FastifyRequest, FastifyReply } from 'fastify';

@Controller('files')
@ApiTags('文件模块')
export class FileController {
    constructor(private readonly fileKernel: FileKernel) {}

    // ─── 预签名 URL ────────────────────────────────────────────────────────────

    @Post('presign/upload')
    @ApiRoute({
        auth: 'required',
        summary: '获取文件上传预签名 URL',
        description:
            '根据提供的文件信息生成预签名 URL 和文件记录 ID（fileId）。客户端使用该 URL 直接上传文件到存储服务后，需调用 PATCH /files/:fileId/confirm 确认上传完成。',
    })
    presignUpload(@Body() dto: PresignUploadDto, @Req() req: FastifyRequest) {
        return this.fileKernel.createUploadSession(req.jwtClaim!.sub, dto);
    }

    @Post('presign/download')
    @ApiRoute({
        auth: 'required',
        summary: '获取私有文件下载预签名 URL',
        description: '为私有存储桶中的文件生成限时预签名下载 URL。',
    })
    presignDownload(@Body() dto: PresignDownloadDto, @Req() req: FastifyRequest) {
        return this.fileKernel.createDownloadUrl(req.jwtClaim!.sub, dto);
    }

    @Get(':fileId/public-url')
    @ApiRoute({
        auth: 'public',
        summary: '获取公开文件直接访问 URL',
        description: '拼接公开存储桶中文件的直接访问 URL（无签名，依赖 CDN 公开访问配置）。',
    })
    publicUrl(@Param('fileId') fileId: string) {
        return this.fileKernel.getPublicUrl(fileId);
    }

    // ─── 确认上传 ──────────────────────────────────────────────────────────────

    @Post(':fileId/confirm')
    @ApiRoute({
        auth: 'required',
        summary: '确认客户端直传完成',
        description: '客户端完成 S3 直传后调用此接口，将文件记录从 PENDING 激活为 ACTIVE。',
    })
    confirmUpload(@Param('fileId') fileId: string, @Req() req: FastifyRequest) {
        const dto: ConfirmUploadDto = { fileId };
        return this.fileKernel.confirmUpload(req.jwtClaim!.sub, dto);
    }

    // ─── 服务端直接操作 ────────────────────────────────────────────────────────

    @Post('server-upload')
    @ApiRoute({
        auth: 'required',
        summary: '服务端直接上传文件（小文件 ≤5MB）',
        description:
            '由服务端接收文件后直接写入对象存储，适用于服务端生成的文件或需要服务端处理的场景。返回文件记录 ID（fileId）。',
        consumes: ['multipart/form-data'],
    })
    async serverUpload(@Req() req: FastifyRequest, @Body() _body: unknown) {
        // TODO: Bind multipart data to ServerUploadDto and delegate to FileKernel.serverUpload.
        // let fileBuffer: Buffer | null = null;
        // let fileMimetype = '';
        // let domain: string | undefined;
        // let filename: string | undefined;

        // for await (const part of req.parts()) {
        //     console.log('Received part:', part);
        //     if (part.type === 'file') {
        //         fileBuffer = await part.toBuffer();
        //         fileMimetype = part.mimetype;
        //     } else {
        //         if (part.fieldname === 'domain') domain = String(part.value);
        //         if (part.fieldname === 'filename') filename = String(part.value);
        //     }
        // }

        // if (!fileBuffer) {
        //     throw new BadRequestException('请上传文件');
        // }

        // const parseResult = ServerUploadDtoSchema.safeParse({ domain, filename, file: undefined });
        // if (!parseResult.success) {
        //     throw new BadRequestException(parseResult.error.message);
        // }

        // return this.fileService.serverUpload(
        //     req.jwtClaim!.sub,
        //     parseResult.data as ServerUploadDto,
        //     fileBuffer,
        //     fileMimetype
        // );

        throw new NotImplementedException('服务端文件上传尚未实现');
    }

    @Get(':fileId/proxy')
    @ApiRoute({
        auth: 'required',
        summary: '代理下载文件',
        description:
            '由服务端从对象存储获取文件并返回给客户端。服务层根据文件大小自动选择传输策略：≤5MB 使用 Buffer（内存读取），>5MB 使用 Stream（流式传输），调用方无需关心具体传输方式。',
    })
    async proxyDownload(
        @Param('fileId') fileId: string,
        @Req() req: FastifyRequest,
        @Res({ passthrough: true }) res: FastifyReply
    ): Promise<StreamableFile> {
        const { data, filename } = await this.fileKernel.proxyDownload(req.jwtClaim!.sub, fileId);
        res.header('Content-Type', 'application/octet-stream');
        res.header('Content-Disposition', `attachment; filename="${filename}"`);
        return new StreamableFile(data as any);
    }

    // @Head(':fileId/exists')
    // @ApiRoute({
    //     auth: 'required',
    //     summary: '检查文件是否存在于对象存储',
    //     description: '使用 HEAD 请求检查指定文件是否存在，文件存在返回 200，不存在返回 404。',
    // })
    // async fileExists(@Param('fileId') fileId: string): Promise<void> {
    //     const exists = await this.fileService.fileExists(fileId);
    //     if (!exists) {
    //         throw new NotFoundException(`文件 ${fileId} 不存在于对象存储`);
    //     }
    // }

    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiRoute({
        auth: 'required',
        summary: '删除文件（单个或批量）',
        description:
            '从对象存储删除文件并软删除数据库记录。fileIds 传入一个时删除单个文件，传入多个时批量删除（最多 1000 个）。',
    })
    deleteFiles(@Body() dto: DeleteFilesDto, @Req() req: FastifyRequest): Promise<void> {
        return this.fileKernel.deleteFiles(req.jwtClaim!.sub, dto);
    }

    // @Post('copy')
    // @ApiRoute({
    //     auth: 'required',
    //     summary: '服务端复制文件',
    //     description: '在服务端复制文件到指定领域，不消耗客户端带宽。返回新文件的 fileId。',
    // })
    // copyFile(@Body() dto: CopyFileDto, @Req() req: Request) {
    //     return this.fileService.copyFile(req.jwtClaim!.sub, dto);
    // }

    // ─── 分片上传 ──────────────────────────────────────────────────────────────

    // @Post('multipart/init')
    // @ApiRoute({
    //     auth: 'required',
    //     summary: '初始化分片上传',
    //     description: '初始化分片上传任务，返回 fileId、uploadId 和每个分片的预签名 URL。',
    // })
    // initMultipart(@Body() dto: MultipartInitDto, @Req() req: Request) {
    //     return this.fileService.initMultipartUpload(req.jwtClaim!.sub, dto);
    // }

    // @Post('multipart/resume')
    // @ApiRoute({
    //     auth: 'required',
    //     summary: '获取断点续传分片预签名 URL',
    //     description: '为未完成的分片重新生成预签名 URL，支持断点续传场景。',
    // })
    // resumeMultipart(@Body() dto: ResumablePartUrlsDto) {
    //     return this.fileService.resumeMultipartUpload(dto);
    // }

    // @Post('multipart/complete')
    // @HttpCode(HttpStatus.NO_CONTENT)
    // @ApiRoute({
    //     auth: 'required',
    //     summary: '完成分片上传',
    //     description: '在所有分片上传完成后，通知服务端合并分片，激活文件记录。',
    // })
    // completeMultipart(@Body() dto: CompleteMultipartDto): Promise<void> {
    //     return this.fileService.completeMultipartUpload(dto);
    // }

    // @Delete('multipart/abort')
    // @HttpCode(HttpStatus.NO_CONTENT)
    // @ApiRoute({
    //     auth: 'required',
    //     summary: '取消分片上传',
    //     description: '取消正在进行的分片上传任务，清理已上传的临时分片，软删除文件记录。',
    // })
    // abortMultipart(@Body() dto: AbortMultipartDto): Promise<void> {
    //     return this.fileService.abortMultipartUpload(dto);
    // }
}
