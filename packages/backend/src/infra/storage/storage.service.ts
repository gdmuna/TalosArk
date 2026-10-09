import { StorageError, type StorageOperation } from './storage.error.js';
import { normalizeStorageError } from './storage-error.normalize.js';
import { S3_OPTIONS } from './storage.constant.js';
import type { StorageModuleOptions } from './storage.interface.js';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'stream';

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    HeadObjectCommand,
    CopyObjectCommand,
    CreateMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    ListPartsCommand,
    ChecksumAlgorithm,
    type CompletedPart,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';

/** 存储桶类型：public（CDN 公开访问）或 private（需鉴权） */
export type BucketType = 'public' | 'private';

/** 分片信息（CompleteMultipartUpload 时使用） */
export type UploadPart = CompletedPart;

/** 分片上传初始化结果 */
export interface MultipartUploadInitResult {
    uploadId: string;
    key: string;
    bucket: string;
}

/** 分片预签名 URL 信息 */
export interface PartPresignResult {
    partNumber: number;
    url: string;
}

/** 已上传分片信息（用于断点续传） */
export interface ListedPart {
    partNumber: number;
    etag: string;
    size: number;
}

const DEFAULT_PRESIGN_EXPIRES = 3600; // 1小时
const DEFAULT_PART_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class StorageService {
    constructor(
        private readonly s3Client: S3Client,
        @Inject(S3_OPTIONS) private readonly opts: StorageModuleOptions,
        @InjectPinoLogger(StorageService.name) private readonly logger: PinoLogger
    ) {}

    // ─── 存储桶解析 ────────────────────────────────────────────────────────────

    /**
     * 根据桶类型解析实际桶名
     */
    resolveBucket(type: BucketType): string {
        return type === 'public' ? this.opts.options.bucketPublic : this.opts.options.bucketPrivate;
    }

    /** 内容寻址暂存桶名 */
    get stagingBucket(): string {
        return this.opts.options.bucketStaging;
    }

    /**
     * 拼接公开文件的直接访问 URL（不带签名，依赖 publicBaseUrl 或 endpoint）
     */
    getPublicUrl(key: string): string {
        const base = this.opts.options.publicBaseUrl ?? this.opts.options.endpoint;
        const bucket = this.opts.options.bucketPublic;
        return `${base.replace(/\/$/, '')}/${bucket}/${key}`;
    }

    // ─── 预签名 URL ────────────────────────────────────────────────────────────

    /**
     * 生成上传预签名 URL（客户端直传）
     * @param bucket 桶类型或实际桶名
     * @param key 对象键
     * @param contentType 文件 MIME 类型
     * @param expiresIn 有效期（秒），默认 3600
     */
    async getUploadUrl(
        bucket: BucketType | string,
        key: string,
        contentType: string,
        expiresIn = DEFAULT_PRESIGN_EXPIRES
    ): Promise<string> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        return this.execute('presign', () =>
            getSignedUrl(
                this.s3Client,
                new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType }),
                { expiresIn }
            )
        );
    }

    /**
     * 生成带 SHA-256 完整性校验的上传预签名 URL（内容寻址存储 CAS）
     *
     * 上传目标为 staging 暂存桶，key = sha256Hex。
     * S3/MinIO 会在收到对象后自动验证 checksum：若内容与声明的 sha256 不符，
     * 直接返回 400，客户端上传失败，无需服务端二次计算。
     *
     * @param sha256Hex  文件内容的 SHA-256 hex 字符串（64位小写十六进制）
     * @param contentType  MIME 类型
     * @param expiresIn  有效期（秒），默认 3600
     */
    async getUploadUrlCAS(
        sha256Hex: string,
        contentType: string,
        expiresIn = DEFAULT_PRESIGN_EXPIRES
    ): Promise<string> {
        // S3 ChecksumSHA256 要求 base64 编码
        const sha256Base64 = Buffer.from(sha256Hex, 'hex').toString('base64');
        return this.execute('presign', () =>
            getSignedUrl(
                this.s3Client,
                new PutObjectCommand({
                    Bucket: this.stagingBucket,
                    Key: sha256Hex,
                    ContentType: contentType,
                    ChecksumAlgorithm: ChecksumAlgorithm.SHA256,
                    ChecksumSHA256: sha256Base64,
                }),
                { expiresIn }
            )
        );
    }

    /**
     * 将 staging 桶中的 CAS 对象移动到目标桶（copy + delete）
     * @param sha256Hex  CAS key（即 staging 桶中的对象键）
     * @param destBucket  目标桶类型或实际桶名
     * @param destKey  目标对象键
     */
    async promoteFromStaging(
        sha256Hex: string,
        destBucket: BucketType | string,
        destKey: string
    ): Promise<void> {
        const dstBucket =
            destBucket === 'public' || destBucket === 'private'
                ? this.resolveBucket(destBucket)
                : destBucket;
        await this.copyObject(this.stagingBucket, sha256Hex, dstBucket, destKey);
        await this.deleteObject(this.stagingBucket, sha256Hex);
    }

    /**
     * 生成下载预签名 URL（私有文件访问/视频流播放）
     * @param bucket 桶类型或实际桶名
     * @param key 对象键
     * @param expiresIn 有效期（秒），默认 3600
     */
    async getDownloadUrl(
        bucket: BucketType | string,
        key: string,
        expiresIn = DEFAULT_PRESIGN_EXPIRES
    ): Promise<string> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        return this.execute('presign', () =>
            getSignedUrl(this.s3Client, new GetObjectCommand({ Bucket: bucketName, Key: key }), {
                expiresIn,
            })
        );
    }

    // ─── 服务端直接操作 ────────────────────────────────────────────────────────

    /**
     * 服务端直接上传文件（小文件，< 5MB）
     */
    async putObject(
        bucket: BucketType | string,
        key: string,
        body: Buffer | Uint8Array | string,
        contentType?: string
    ): Promise<void> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            await this.s3Client.send(
                new PutObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                    Body: body,
                    ContentType: contentType,
                })
            );
            this.logger.debug('Object uploaded');
        } catch (err) {
            throw normalizeStorageError(err, 'upload') ?? err;
        }
    }

    /**
     * 服务端流式上传大文件（自动分片，支持进度回调）
     * @param onProgress 可选进度回调 (loaded, total)
     */
    async uploadStream(
        bucket: BucketType | string,
        key: string,
        body: Readable | Buffer,
        contentType?: string,
        onProgress?: (loaded: number, total?: number) => void
    ): Promise<void> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            const upload = new Upload({
                client: this.s3Client,
                params: { Bucket: bucketName, Key: key, Body: body, ContentType: contentType },
                queueSize: 4,
                partSize: DEFAULT_PART_SIZE,
                leavePartsOnError: false,
            });

            if (onProgress) {
                upload.on('httpUploadProgress', (p) => onProgress(p.loaded ?? 0, p.total));
            }

            await upload.done();
            this.logger.debug('Stream uploaded');
        } catch (err) {
            throw normalizeStorageError(err, 'upload') ?? err;
        }
    }

    /**
     * 下载文件为 Buffer（小文件）
     */
    async getObject(bucket: BucketType | string, key: string): Promise<Buffer> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            const resp = await this.s3Client.send(
                new GetObjectCommand({ Bucket: bucketName, Key: key })
            );
            if (!resp.Body)
                throw new StorageError({ reason: 'invalid-response', operation: 'download' });
            const bytes = await resp.Body.transformToByteArray();
            return Buffer.from(bytes);
        } catch (err) {
            throw normalizeStorageError(err, 'download') ?? err;
        }
    }

    /**
     * 获取文件可读流（大文件/视频代理场景）
     *
     * 注意：AWS SDK v3 的 resp.Body 是 ChecksumStream（非标准 Readable，含循环引用），
     * 通过异步迭代中继转换为标准 Node.js Readable，同时包装传输中的晚到错误。
     */
    async getObjectStream(bucket: BucketType | string, key: string): Promise<Readable> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        let resp;
        try {
            resp = await this.s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
        } catch (err) {
            throw normalizeStorageError(err, 'download') ?? err;
        }
        if (!resp.Body) {
            throw new StorageError({ reason: 'invalid-response', operation: 'download' });
        }
        const body = resp.Body as Readable;
        return Readable.from(
            (async function* () {
                try {
                    for await (const chunk of body) yield chunk;
                } catch (err) {
                    throw normalizeStorageError(err, 'download') ?? err;
                }
            })(),
            { objectMode: false }
        );
    }

    /**
     * 删除单个文件
     */
    async deleteObject(bucket: BucketType | string, key: string): Promise<void> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            await this.s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
            this.logger.debug('Object deleted');
        } catch (err) {
            throw normalizeStorageError(err, 'delete') ?? err;
        }
    }

    /**
     * 批量删除文件（最多 1000 个）
     */
    async deleteObjects(bucket: BucketType | string, keys: string[]): Promise<void> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            const result = await this.s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: bucketName,
                    Delete: { Objects: keys.map((Key) => ({ Key })) },
                })
            );
            if (result.Errors?.length) {
                throw new StorageError({ reason: 'partial-delete', operation: 'delete' });
            }
            this.logger.debug({ count: keys.length }, 'Objects deleted');
        } catch (err) {
            throw normalizeStorageError(err, 'delete') ?? err;
        }
    }

    /**
     * 检查文件是否存在（HEAD 请求，不传输文件内容）
     */
    async objectExists(bucket: BucketType | string, key: string): Promise<boolean> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            await this.s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
            return true;
        } catch (err) {
            const normalized = normalizeStorageError(err, 'download');
            if (normalized?.failure.reason === 'not-found') {
                return false;
            }
            throw normalized ?? err;
        }
    }

    /**
     * 获取对象大小（字节），通过 HEAD 请求，不传输文件内容。
     * 若对象不存在则抛出 reason=not-found 的 StorageError。
     */
    async getObjectSize(bucket: BucketType | string, key: string): Promise<number> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            const resp = await this.s3Client.send(
                new HeadObjectCommand({ Bucket: bucketName, Key: key })
            );
            return resp.ContentLength ?? 0;
        } catch (err) {
            throw normalizeStorageError(err, 'download') ?? err;
        }
    }

    /**
     * 服务端复制文件（桶内或跨桶，不消耗带宽）
     */
    async copyObject(
        sourceBucket: BucketType | string,
        sourceKey: string,
        destBucket: BucketType | string,
        destKey: string
    ): Promise<void> {
        const srcBucket =
            sourceBucket === 'public' || sourceBucket === 'private'
                ? this.resolveBucket(sourceBucket)
                : sourceBucket;
        const dstBucket =
            destBucket === 'public' || destBucket === 'private'
                ? this.resolveBucket(destBucket)
                : destBucket;
        try {
            await this.s3Client.send(
                new CopyObjectCommand({
                    Bucket: dstBucket,
                    Key: destKey,
                    CopySource: `${srcBucket}/${sourceKey}`,
                })
            );
            this.logger.debug('Object copied');
        } catch (err) {
            throw normalizeStorageError(err, 'copy') ?? err;
        }
    }

    // ─── 分片上传（客户端直传协调） ───────────────────────────────────────────

    /**
     * 初始化分片上传，返回 uploadId 和各分片预签名 URL
     * @param partCount 分片总数
     * @param expiresIn 每个分片 URL 的有效期（秒），默认 3600
     */
    async initMultipartUpload(
        bucket: BucketType | string,
        key: string,
        contentType: string,
        partCount: number,
        expiresIn = DEFAULT_PRESIGN_EXPIRES
    ): Promise<{ uploadId: string; partUrls: PartPresignResult[] }> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            const { UploadId } = await this.s3Client.send(
                new CreateMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: key,
                    ContentType: contentType,
                })
            );
            if (!UploadId)
                throw new StorageError({ reason: 'invalid-response', operation: 'multipart-init' });

            const partUrls = await Promise.all(
                Array.from({ length: partCount }, (_, i) =>
                    getSignedUrl(
                        this.s3Client,
                        new PutObjectCommand({
                            Bucket: bucketName,
                            Key: key,
                            UploadId,
                            PartNumber: i + 1,
                        } as any),
                        { expiresIn }
                    ).then((url) => ({ partNumber: i + 1, url }))
                )
            );

            this.logger.debug('Multipart upload initiated');
            return { uploadId: UploadId, partUrls };
        } catch (err) {
            throw normalizeStorageError(err, 'multipart-init') ?? err;
        }
    }

    /**
     * 为未完成的分片重新生成预签名 URL（断点续传场景）
     * @param completedPartNumbers 已完成的分片编号列表
     */
    async getResumablePartUrls(
        bucket: BucketType | string,
        key: string,
        uploadId: string,
        totalParts: number,
        completedPartNumbers: number[],
        expiresIn = DEFAULT_PRESIGN_EXPIRES
    ): Promise<{ completedParts: ListedPart[]; partUrls: PartPresignResult[] }> {
        return this.execute('multipart-list', async () => {
            const bucketName =
                bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;

            // 从 S3 查询已完成的分片（权威来源）
            const { Parts = [] } = await this.s3Client.send(
                new ListPartsCommand({ Bucket: bucketName, Key: key, UploadId: uploadId })
            );

            const completedSet = new Set(Parts.map((p) => p.PartNumber ?? 0));
            const remaining = Array.from({ length: totalParts }, (_, i) => i + 1).filter(
                (n) => !completedSet.has(n)
            );

            const partUrls = await Promise.all(
                remaining.map((partNumber) =>
                    getSignedUrl(
                        this.s3Client,
                        new PutObjectCommand({
                            Bucket: bucketName,
                            Key: key,
                            UploadId: uploadId,
                            PartNumber: partNumber,
                        } as any),
                        { expiresIn }
                    ).then((url) => ({ partNumber, url }))
                )
            );

            return {
                completedParts: Parts.map((p) => ({
                    partNumber: p.PartNumber ?? 0,
                    etag: p.ETag ?? '',
                    size: p.Size ?? 0,
                })),
                partUrls,
            };
        });
    }

    /**
     * 完成分片上传（合并所有分片）
     */
    async completeMultipartUpload(
        bucket: BucketType | string,
        key: string,
        uploadId: string,
        parts: UploadPart[]
    ): Promise<void> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            await this.s3Client.send(
                new CompleteMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: key,
                    UploadId: uploadId,
                    MultipartUpload: { Parts: parts },
                })
            );
            this.logger.debug('Multipart upload completed');
        } catch (err) {
            throw normalizeStorageError(err, 'multipart-complete') ?? err;
        }
    }

    /**
     * 取消分片上传（清理 S3 上的临时分片，避免持续计费）
     */
    async abortMultipartUpload(
        bucket: BucketType | string,
        key: string,
        uploadId: string
    ): Promise<void> {
        const bucketName =
            bucket === 'public' || bucket === 'private' ? this.resolveBucket(bucket) : bucket;
        try {
            await this.s3Client.send(
                new AbortMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: key,
                    UploadId: uploadId,
                })
            );
            this.logger.debug('Multipart upload aborted');
        } catch (err) {
            throw normalizeStorageError(err, 'multipart-abort') ?? err;
        }
    }

    private async execute<T>(operation: StorageOperation, run: () => PromiseLike<T>): Promise<T> {
        try {
            return await run();
        } catch (error) {
            throw normalizeStorageError(error, operation) ?? error;
        }
    }
}
