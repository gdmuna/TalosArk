import { FileRepository } from './internal/file.repository.js';
import { DocumentStrategy } from './internal/strategies/document.strategy.js';
import { ImageStrategy } from './internal/strategies/image.strategy.js';
import { VideoStrategy } from './internal/strategies/video.strategy.js';
import {
    FileAccessDeniedException,
    FileInvalidDomainException,
    FileRecordNotFoundException,
    FileStagingNotFoundException,
} from './file.exception.js';
import { PROXY_SIZE_THRESHOLD } from './file.constant.js';
import type { UploadStrategy } from './internal/upload-strategy.js';
import type {
    ConfirmUploadCommand,
    CopyFileCommand,
    CreateDownloadUrlCommand,
    CreateUploadSessionCommand,
    CreateUploadSessionResult,
    DeleteFilesCommand,
    ServerUploadCommand,
} from './file.types.js';

import { StorageService } from '@/infra/storage/storage.service.js';
import type {
    BucketType,
    // UploadPart
} from '@/infra/storage/storage.service.js';

import type { FileModel } from '@root/prisma/generated/models/File.js';
import { FileDomain, FileStatus, FileVisibility } from '@root/prisma/generated/enums.js';

import { Injectable } from '@nestjs/common';
import type { Readable } from 'stream';

@Injectable()
export class FileKernel {
    private readonly strategies: Record<FileDomain, UploadStrategy>;

    constructor(
        private readonly storageService: StorageService,
        private readonly fileRepo: FileRepository,
        private readonly documentStrategy: DocumentStrategy,
        private readonly imageStrategy: ImageStrategy,
        private readonly videoStrategy: VideoStrategy
    ) {
        this.strategies = {
            AVATAR: this.imageStrategy,
            DOCUMENT: this.documentStrategy,
            VIDEO: this.videoStrategy,
        };
    }

    // ─── 预签名 URL ────────────────────────────────────────────────────────────

    /**
     * 获取上传预签名 URL（客户端直传）
     * 在数据库中创建状态为 PENDING 的文件记录，返回预签名 URL 和 fileId。
     * 客户端上传完成后需调用 confirmUpload 激活文件记录。
     *
     * 当 dto.sha256 存在时，启用 CAS 流程：
     *   - 上传目标为 staging 桶，key = sha256Hex
     *   - 预签名 URL 含 SHA-256 checksum 强制校验（S3 层实现）
     *   - 实际目标桶/key（strategy 决定）存储在 DB 记录，confirmUpload 时搬运
     */
    async createUploadSession(
        userId: string,
        dto: CreateUploadSessionCommand
    ): Promise<CreateUploadSessionResult> {
        const strategy = this.resolveStrategy(dto.domain);
        strategy.validate(dto);
        const key = strategy.resolveKey(userId, dto.filename);
        const bucket = strategy.getBucket() as BucketType;

        // let uploadUrl: string;
        // if (dto.sha256) {
        //     // CAS 流程：上传到 staging 桶，启用 S3 checksum 校验
        //     uploadUrl = await this.storageService.getUploadUrlCAS(dto.sha256, dto.contentType);
        // } else {
        //     uploadUrl = await this.storageService.getUploadUrl(bucket, key, dto.contentType);
        // }
        const uploadUrl = await this.storageService.getUploadUrl(bucket, key, dto.contentType);

        const record = await this.fileRepo.create({
            userId,
            domain: dto.domain,
            bucket,
            key,
            filename: dto.filename,
            contentType: dto.contentType,
            visibility: bucket === 'public' ? FileVisibility.PUBLIC : FileVisibility.PRIVATE,
            // sha256: dto.sha256,
        });

        // if (dto.sha256) {
        //     // 将期望的 sha256 存入 KVS，供 confirmUpload 快速查验，TTL = 1小时 + 5分钟容错
        //     await this.cacheManager.set(
        //         `cas:pending:${record.id}`,
        //         dto.sha256,
        //         (3600 + 300) * 1000
        //     );
        // }

        return { fileId: record.id, uploadUrl };
    }

    /**
     * 确认客户端上传已完成，将文件记录从 PENDING 激活为 ACTIVE
     *
     * 当文件记录含 sha256 时（CAS 流程）：
     *   1. 验证 staging 桶中对应对象存在（可导出客户端上传失败或 URL 已过期）
     *   2. 将对象从 staging 搞运到最终目标桶
     *   3. 清理 KVS 中的临时字段
     */
    async confirmUpload(userId: string, dto: ConfirmUploadCommand): Promise<FileModel> {
        const record = await this.requireOwnedFile(userId, dto.fileId);

        if (record.status === FileStatus.ACTIVE) {
            return record;
        }

        if (record.status !== FileStatus.PENDING) {
            throw new FileRecordNotFoundException({ message: `文件 ${dto.fileId} 不存在` });
        }

        const objectExists = await this.storageService.objectExists(
            record.bucket as BucketType,
            record.key
        );
        if (!objectExists) {
            throw new FileStagingNotFoundException({
                message: `文件 ${dto.fileId} 的上传对象尚未就绪`,
            });
        }

        // if (record.sha256) {
        //     // 验证 staging 桶中对应对象是否存在
        //     const stagingExists = await this.storageService.objectExists(
        //         this.storageService.stagingBucket,
        //         record.sha256
        //     );
        //     if (!stagingExists) {
        //         throw new FileStagingNotFoundException({
        //             message: `文件 ${dto.fileId} 的暂存对象未找到，请确认已完成上传`,
        //         });
        //     }

        //     // 将对象从 staging 移动到最终目标桶
        //     await this.storageService.promoteFromStaging(
        //         record.sha256,
        //         record.bucket as BucketType,
        //         record.key
        //     );

        //     // 清理 KVS 临时条目
        //     await this.cacheManager.del(`cas:pending:${record.id}`);
        // }

        return this.fileRepo.updateStatus(record.id, FileStatus.ACTIVE);
    }

    /**
     * 获取下载预签名 URL（私有文件访问）
     */
    async createDownloadUrl(userId: string, dto: CreateDownloadUrlCommand): Promise<string> {
        const record = await this.requireOwnedActiveFile(userId, dto.fileId);
        return this.storageService.getDownloadUrl(record.bucket, record.key, dto.expiresIn);
    }

    /**
     * 获取公开文件的直接访问 URL（不带签名，依赖 CDN / publicBaseUrl）
     */
    async getPublicUrl(fileId: string): Promise<string> {
        const record = await this.requireActiveFile(fileId);
        if (record.visibility !== FileVisibility.PUBLIC) {
            throw new FileRecordNotFoundException({ message: `文件 ${fileId} 不存在` });
        }

        return this.storageService.getPublicUrl(record.key);
    }

    // ─── 服务端直接操作 ────────────────────────────────────────────────────────

    /**
     * 服务端直接上传文件（小文件，≤5MB）
     * 创建并立即激活文件记录，返回 fileId。
     */
    async serverUpload(
        userId: string,
        dto: ServerUploadCommand,
        body: Buffer | Uint8Array,
        contentType: string
    ): Promise<{ fileId: string }> {
        const strategy = this.resolveStrategy(dto.domain);
        strategy.validate({ contentType });
        const key = strategy.resolveKey(userId, dto.filename);
        const bucket = strategy.getBucket() as BucketType;
        await this.storageService.putObject(bucket, key, body, contentType);
        const record = await this.fileRepo.create({
            userId,
            domain: dto.domain,
            bucket,
            key,
            filename: dto.filename,
            contentType,
            visibility: bucket === 'public' ? FileVisibility.PUBLIC : FileVisibility.PRIVATE,
        });
        await this.fileRepo.updateStatus(record.id, 'ACTIVE');
        return { fileId: record.id };
    }

    /**
     * 代理下载文件。
     * 内部通过 HEAD 请求获取文件大小：
     *   - ≤ PROXY_SIZE_THRESHOLD（5MB）→ Buffer（一次性读入内存，适合小文件）
     *   - > PROXY_SIZE_THRESHOLD → Stream（流式传输，适合大文件/视频）
     */
    async proxyDownload(
        userId: string,
        fileId: string
    ): Promise<{ data: Buffer | Readable; filename: string; isStream: boolean }> {
        const record = await this.requireOwnedActiveFile(userId, fileId);
        const size = await this.storageService.getObjectSize(record.bucket, record.key);
        if (size <= PROXY_SIZE_THRESHOLD) {
            const buffer = await this.storageService.getObject(record.bucket, record.key);
            return { data: buffer, filename: record.filename, isStream: false };
        }
        const stream = await this.storageService.getObjectStream(record.bucket, record.key);
        return { data: stream, filename: record.filename, isStream: true };
    }

    /**
     * 检查文件是否存在于对象存储
     */
    async fileExists(fileId: string): Promise<boolean> {
        const record = await this.requireFile(fileId);
        return this.storageService.objectExists(record.bucket, record.key);
    }

    /**
     * 删除文件（单个或批量）
     * 从对象存储删除后，将数据库记录标记为 DELETED（软删除）。
     */
    async deleteFiles(userId: string, dto: DeleteFilesCommand): Promise<void> {
        const records = await Promise.all(
            dto.fileIds.map((id) => this.requireOwnedFile(userId, id))
        );

        if (records.length === 1) {
            await this.storageService.deleteObject(records[0].bucket, records[0].key);
        } else {
            // 同一 bucket 内批量删除（按 bucket 分组）
            const byBucket = new Map<string, string[]>();
            for (const r of records) {
                const keys = byBucket.get(r.bucket) ?? [];
                keys.push(r.key);
                byBucket.set(r.bucket, keys);
            }
            await Promise.all(
                [...byBucket.entries()].map(([bucket, keys]) =>
                    this.storageService.deleteObjects(bucket, keys)
                )
            );
        }

        await this.fileRepo.softDeleteMany(dto.fileIds);
    }

    /**
     * 服务端复制文件（桶内或跨桶，不消耗带宽）
     * 在数据库中创建新的文件记录（ACTIVE），返回新 fileId。
     */
    async copyFile(userId: string, dto: CopyFileCommand): Promise<{ fileId: string }> {
        const src = await this.requireOwnedActiveFile(userId, dto.fileId);
        const destStrategy = this.resolveStrategy(dto.destDomain);
        const destFilename = dto.destFilename ?? src.filename;
        const destKey = destStrategy.resolveKey(userId, destFilename);
        const destBucket = destStrategy.getBucket() as BucketType;
        await this.storageService.copyObject(src.bucket, src.key, destBucket, destKey);
        const newRecord = await this.fileRepo.create({
            userId,
            domain: dto.destDomain,
            bucket: destBucket,
            key: destKey,
            filename: destFilename,
            contentType: src.contentType,
            visibility: destBucket === 'public' ? FileVisibility.PUBLIC : FileVisibility.PRIVATE,
        });
        await this.fileRepo.updateStatus(newRecord.id, 'ACTIVE');
        return { fileId: newRecord.id };
    }

    // ─── 分片上传 ──────────────────────────────────────────────────────────────

    /**
     * 初始化分片上传，返回 fileId、uploadId 和各分片预签名 URL
     */
    // async initMultipartUpload(
    //     userId: string,
    //     dto: MultipartInitDto
    // ): Promise<{
    //     fileId: string;
    //     uploadId: string;
    //     partUrls: { partNumber: number; url: string }[];
    // }> {
    //     const strategy = this.resolveStrategy(dto.domain);
    //     strategy.validate(dto);
    //     const key = strategy.resolveKey(userId, dto.filename);
    //     const bucket = strategy.getBucket() as BucketType;
    //     const partCount = strategy.getPartCount(dto.fileSize);
    //     const { uploadId, partUrls } = await this.storageService.initMultipartUpload(
    //         bucket,
    //         key,
    //         dto.contentType,
    //         partCount
    //     );
    //     const record = await this.fileRepo.create({
    //         userId,
    //         domain: dto.domain,
    //         bucket,
    //         key,
    //         filename: dto.filename,
    //         contentType: dto.contentType,
    //         uploadId,
    //     });
    //     return { fileId: record.id, uploadId, partUrls };
    // }

    /**
     * 获取断点续传分片预签名 URL
     */
    // async resumeMultipartUpload(dto: ResumablePartUrlsDto) {
    //     const record = await this.requireFile(dto.fileId);
    //     if (!record.uploadId) {
    //         throw new FileRecordNotFoundException({
    //             message: `文件 ${dto.fileId} 没有关联的分片上传任务`,
    //         });
    //     }
    //     return this.storageService.getResumablePartUrls(
    //         record.bucket,
    //         record.key,
    //         record.uploadId,
    //         dto.totalParts,
    //         dto.completedPartNumbers,
    //         dto.expiresIn
    //     );
    // }

    /**
     * 完成分片上传（合并所有分片），激活文件记录
     */
    // async completeMultipartUpload(dto: CompleteMultipartDto): Promise<void> {
    //     const record = await this.requireFile(dto.fileId);
    //     if (!record.uploadId) {
    //         throw new FileRecordNotFoundException({
    //             message: `文件 ${dto.fileId} 没有关联的分片上传任务`,
    //         });
    //     }
    //     const parts: UploadPart[] = dto.parts.map((p) => ({
    //         PartNumber: p.PartNumber,
    //         ETag: p.ETag,
    //     }));
    //     await this.storageService.completeMultipartUpload(
    //         record.bucket,
    //         record.key,
    //         record.uploadId,
    //         parts
    //     );
    //     await this.fileRepo.updateStatus(record.id, 'ACTIVE', null);
    // }

    /**
     * 取消分片上传（清理临时分片），软删除文件记录
     */
    // async abortMultipartUpload(dto: AbortMultipartDto): Promise<void> {
    //     const record = await this.requireFile(dto.fileId);
    //     if (record.uploadId) {
    //         await this.storageService.abortMultipartUpload(
    //             record.bucket,
    //             record.key,
    //             record.uploadId
    //         );
    //     }
    //     await this.fileRepo.softDelete(record.id);
    // }

    // ─── 内部工具 ──────────────────────────────────────────────────────────────

    private resolveStrategy(domain: FileDomain): UploadStrategy {
        const strategy = this.strategies[domain];
        if (!strategy) {
            throw new FileInvalidDomainException({
                message: `不支持的文件领域: ${domain}，支持：${Object.keys(this.strategies).join(', ')}`,
            });
        }
        return strategy;
    }

    private async requireFile(fileId: string): Promise<FileModel> {
        const record = await this.fileRepo.findById(fileId);
        if (!record || record.status === FileStatus.DELETED) {
            throw new FileRecordNotFoundException({ message: `文件 ${fileId} 不存在` });
        }
        return record;
    }

    private async requireActiveFile(fileId: string): Promise<FileModel> {
        const record = await this.requireFile(fileId);
        if (record.status !== FileStatus.ACTIVE) {
            throw new FileRecordNotFoundException({ message: `文件 ${fileId} 不存在` });
        }
        return record;
    }

    private async requireOwnedFile(userId: string, fileId: string): Promise<FileModel> {
        const record = await this.requireFile(fileId);
        if (record.userId !== userId) {
            throw new FileAccessDeniedException();
        }
        return record;
    }

    private async requireOwnedActiveFile(userId: string, fileId: string): Promise<FileModel> {
        const record = await this.requireOwnedFile(userId, fileId);
        if (record.status !== FileStatus.ACTIVE) {
            throw new FileRecordNotFoundException({ message: `文件 ${fileId} 不存在` });
        }
        return record;
    }
}
