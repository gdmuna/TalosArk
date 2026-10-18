import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    HeadObjectCommand,
    CopyObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    ListPartsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { addAbortSignal, Readable } from 'node:stream';
import { S3_OPTIONS } from './storage.constant.js';
import type { StorageModuleOptions } from './storage.options.js';
import type {
    ObjectLocation,
    ObjectWriteOptions,
    ObjectStat,
    ObjectStatOptions,
    ObjectBody,
    StreamBody,
    StreamUploadOptions,
    PresignOptions,
    PresignedRequest,
    MultipartUpload,
    MultipartUploadOptions,
    MultipartPartPresignOptions,
    MultipartCompletionPart,
    UploadedPart,
    StorageRequestOptions,
    DownloadPresignOptions,
} from './storage.contract.js';
import { StorageError, type StorageOperation } from './storage.error.js';
import { normalizeStorageError } from './storage.error.normalize.js';

const DEFAULT_PRESIGN_EXPIRES = 3600;
const MAX_PRESIGN_EXPIRES = 604800;
const MAX_PART_NUMBER = 10000;
const DELETE_BATCH_SIZE = 1000;
const STREAM_PART_SIZE = 5 * 1024 * 1024;
type SignRequest = (options: NonNullable<Parameters<typeof getSignedUrl>[2]>) => Promise<string>;

function encodePath(value: string): string {
    return value
        .split('/')
        .map((segment) =>
            encodeURIComponent(segment).replace(
                /[!'()*]/g,
                (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
            )
        )
        .join('/');
}

@Injectable()
export class StorageService implements OnModuleDestroy {
    constructor(
        private readonly s3Client: S3Client,
        @Inject(S3_OPTIONS) private readonly opts: StorageModuleOptions,
        @InjectPinoLogger(StorageService.name) private readonly logger: PinoLogger
    ) {}

    onModuleDestroy(): void {
        this.s3Client.destroy();
    }

    /** URL construction only. The caller owns authorization and public-access policy. */
    getPublicUrl(object: ObjectLocation): string {
        const base = this.opts.options.publicBaseUrl ?? this.opts.options.endpoint;
        return `${base.replace(/\/$/, '')}/${encodePath(object.bucket)}/${encodePath(object.key)}`;
    }

    async presignUpload(
        object: ObjectLocation,
        options: ObjectWriteOptions & PresignOptions = {}
    ): Promise<PresignedRequest> {
        const sha256 = this.checksumBase64(options.sha256, 'presign');
        const headers: Record<string, string> = {};
        if (options.contentType) headers['content-type'] = options.contentType;
        if (sha256) headers['x-amz-checksum-sha256'] = sha256;
        const command = new PutObjectCommand({
            Bucket: object.bucket,
            Key: object.key,
            ContentType: options.contentType,
            ChecksumSHA256: sha256,
        });
        return this.presign(
            (signingOptions) => getSignedUrl(this.s3Client, command, signingOptions),
            'PUT',
            headers,
            options
        );
    }

    async presignDownload(
        object: ObjectLocation,
        options: DownloadPresignOptions = {}
    ): Promise<PresignedRequest> {
        for (const value of [options.contentDisposition, options.contentType]) {
            if (
                value !== undefined &&
                (value.length > 4096 || !value.isWellFormed() || /[\r\n]/.test(value))
            )
                throw new StorageError({ reason: 'invalid-request', operation: 'presign' });
        }
        const command = new GetObjectCommand({
            Bucket: object.bucket,
            Key: object.key,
            ResponseContentDisposition: options.contentDisposition,
            ResponseContentType: options.contentType,
        });
        return this.presign(
            (signingOptions) => getSignedUrl(this.s3Client, command, signingOptions),
            'GET',
            {},
            options
        );
    }

    async putObject(
        object: ObjectLocation,
        body: ObjectBody,
        options: ObjectWriteOptions = {}
    ): Promise<void> {
        const sha256 = this.checksumBase64(options.sha256, 'upload');
        await this.execute('upload', () =>
            this.s3Client.send(
                new PutObjectCommand({
                    Bucket: object.bucket,
                    Key: object.key,
                    Body: body,
                    ContentType: options.contentType,
                    ChecksumSHA256: sha256,
                })
            )
        );
    }

    async uploadStream(
        object: ObjectLocation,
        body: StreamBody,
        options: StreamUploadOptions = {}
    ): Promise<void> {
        await this.execute('upload', async () => {
            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: object.bucket,
                    Key: object.key,
                    Body: body,
                    ContentType: options.contentType,
                },
                queueSize: 4,
                partSize: STREAM_PART_SIZE,
                leavePartsOnError: false,
            });
            if (options.onProgress) {
                upload.on('httpUploadProgress', (progress) =>
                    options.onProgress?.(progress.loaded ?? 0, progress.total)
                );
            }
            await upload.done();
        });
    }

    /** Buffers the entire object. Use getObjectStream for unbounded payloads. */
    getObject(object: ObjectLocation): Promise<Buffer> {
        return this.execute('download', async () => {
            const response = await this.s3Client.send(
                new GetObjectCommand({ Bucket: object.bucket, Key: object.key })
            );
            if (!response.Body) {
                throw new StorageError({ reason: 'invalid-response', operation: 'download' });
            }
            return Buffer.from(await response.Body.transformToByteArray());
        });
    }

    async getObjectStream(
        object: ObjectLocation,
        options: StorageRequestOptions = {}
    ): Promise<Readable> {
        const response = await this.execute('download', () =>
            this.s3Client.send(new GetObjectCommand({ Bucket: object.bucket, Key: object.key }), {
                abortSignal: options.signal,
            })
        );
        if (!response.Body) {
            throw new StorageError({ reason: 'invalid-response', operation: 'download' });
        }
        const body = response.Body as Readable;
        // Normalize errors from consuming the body, not just acquiring the response.
        const stream = Readable.from(
            (async function* () {
                try {
                    for await (const chunk of body) yield chunk;
                } catch (error) {
                    throw normalizeStorageError(error, 'download') ?? error;
                } finally {
                    body.destroy();
                }
            })(),
            { objectMode: false }
        );
        const forwardError = (error: Error) =>
            stream.destroy(normalizeStorageError(error, 'download') ?? error);
        body.once('error', forwardError);
        body.once('close', () => body.removeListener('error', forwardError));
        stream.once('close', () => body.destroy());
        if (options.signal) addAbortSignal(options.signal, body);
        return stream;
    }

    statObject(object: ObjectLocation, options: ObjectStatOptions = {}): Promise<ObjectStat> {
        return this.execute('stat', async () => {
            const response = await this.s3Client.send(
                new HeadObjectCommand({
                    Bucket: object.bucket,
                    Key: object.key,
                    ChecksumMode: options.checksum ? 'ENABLED' : undefined,
                }),
                { abortSignal: options.signal }
            );
            if (
                response.ContentLength === undefined ||
                !Number.isSafeInteger(response.ContentLength) ||
                response.ContentLength < 0
            ) {
                throw new StorageError({ reason: 'invalid-response', operation: 'stat' });
            }
            return {
                sizeBytes: response.ContentLength,
                contentType: response.ContentType,
                etag: response.ETag,
                lastModifiedAt: response.LastModified,
                // prettier-ignore
                checksum: response.ChecksumSHA256
                    ? {
                        algorithm: 'sha256',
                        value: response.ChecksumSHA256,
                        type:
                            response.ChecksumType === 'FULL_OBJECT'
                                ? 'full-object'
                                : response.ChecksumType === 'COMPOSITE'
                                ? 'composite'
                                : undefined,
                    }
                    : undefined,
            };
        });
    }

    async deleteObject(object: ObjectLocation, options: StorageRequestOptions = {}): Promise<void> {
        await this.execute('delete', () =>
            this.s3Client.send(
                new DeleteObjectCommand({ Bucket: object.bucket, Key: object.key }),
                { abortSignal: options.signal }
            )
        );
    }

    /** Non-atomic: earlier batches may have succeeded when a later batch fails. */
    async deleteObjects(objects: readonly ObjectLocation[]): Promise<void> {
        const buckets = new Map<string, string[]>();
        for (const object of objects) {
            const keys = buckets.get(object.bucket) ?? [];
            keys.push(object.key);
            buckets.set(object.bucket, keys);
        }
        for (const [bucket, keys] of buckets) {
            for (let offset = 0; offset < keys.length; offset += DELETE_BATCH_SIZE) {
                await this.execute('delete', async () => {
                    const result = await this.s3Client.send(
                        new DeleteObjectsCommand({
                            Bucket: bucket,
                            Delete: {
                                Objects: keys
                                    .slice(offset, offset + DELETE_BATCH_SIZE)
                                    .map((Key) => ({ Key })),
                            },
                        })
                    );
                    if (result.Errors?.length) {
                        throw new StorageError({
                            reason: 'partial-delete',
                            operation: 'delete',
                            failedObjects: result.Errors.map((failure) => ({
                                bucket,
                                key: failure.Key,
                                code: failure.Code,
                            })),
                        });
                    }
                });
            }
        }
    }

    /** Copy does not delete its source or advance any File/database state. */
    async copyObject(
        source: ObjectLocation,
        destination: ObjectLocation,
        options: StorageRequestOptions = {}
    ): Promise<void> {
        await this.execute('copy', () =>
            this.s3Client.send(
                new CopyObjectCommand({
                    Bucket: destination.bucket,
                    Key: destination.key,
                    CopySource: `${encodePath(source.bucket)}/${encodePath(source.key)}`,
                }),
                { abortSignal: options.signal }
            )
        );
    }

    createMultipartUpload(
        object: ObjectLocation,
        options: MultipartUploadOptions = {}
    ): Promise<MultipartUpload> {
        return this.execute('multipart-init', async () => {
            const response = await this.s3Client.send(
                new CreateMultipartUploadCommand({
                    Bucket: object.bucket,
                    Key: object.key,
                    ContentType: options.contentType,
                    ChecksumAlgorithm:
                        options.checksumAlgorithm === 'sha256' ? 'SHA256' : undefined,
                }),
                { abortSignal: options.signal }
            );
            if (!response.UploadId) {
                throw new StorageError({ reason: 'invalid-response', operation: 'multipart-init' });
            }
            return { object: { ...object }, uploadId: response.UploadId };
        });
    }

    async presignMultipartPart(
        upload: MultipartUpload,
        partNumber: number,
        options: MultipartPartPresignOptions = {}
    ): Promise<PresignedRequest> {
        this.validatePartNumber(partNumber, 'presign', 'invalid-request');
        const sha256 = this.checksumBase64(options.sha256, 'presign');
        const command = new UploadPartCommand({
            Bucket: upload.object.bucket,
            Key: upload.object.key,
            UploadId: upload.uploadId,
            PartNumber: partNumber,
            ChecksumSHA256: sha256,
        });
        return this.presign(
            (signingOptions) => getSignedUrl(this.s3Client, command, signingOptions),
            'PUT',
            sha256 ? { 'x-amz-checksum-sha256': sha256 } : {},
            options
        );
    }

    /** Returns all provider-confirmed parts, not a client-reported completion list. */
    listMultipartParts(
        upload: MultipartUpload,
        options: StorageRequestOptions = {}
    ): Promise<UploadedPart[]> {
        return this.execute('multipart-list', async () => {
            const parts = new Map<number, UploadedPart>();
            let marker: number | undefined;
            for (;;) {
                const response = await this.s3Client.send(
                    new ListPartsCommand({
                        Bucket: upload.object.bucket,
                        Key: upload.object.key,
                        UploadId: upload.uploadId,
                        PartNumberMarker: marker?.toString(),
                    }),
                    { abortSignal: options.signal }
                );
                for (const part of response.Parts ?? []) {
                    const number = part.PartNumber;
                    this.validatePartNumber(number, 'multipart-list', 'invalid-response');
                    if (
                        parts.has(number) ||
                        number <= (marker ?? 0) ||
                        !part.ETag ||
                        part.Size === undefined ||
                        !Number.isSafeInteger(part.Size) ||
                        part.Size < 0
                    ) {
                        throw new StorageError({
                            reason: 'invalid-response',
                            operation: 'multipart-list',
                        });
                    }
                    parts.set(number, {
                        partNumber: number,
                        etag: part.ETag,
                        sizeBytes: part.Size,
                        checksumSha256: part.ChecksumSHA256,
                    });
                }
                if (!response.IsTruncated) break;
                const next = Number(response.NextPartNumberMarker);
                this.validatePartNumber(next, 'multipart-list', 'invalid-response');
                if (next <= (marker ?? 0)) {
                    throw new StorageError({
                        reason: 'invalid-response',
                        operation: 'multipart-list',
                    });
                }
                marker = next;
            }
            return [...parts.values()].sort((a, b) => a.partNumber - b.partNumber);
        });
    }

    /** Validates protocol fields; File must establish ownership and the expected manifest. */
    async completeMultipartUpload(
        upload: MultipartUpload,
        parts: readonly MultipartCompletionPart[],
        options: StorageRequestOptions = {}
    ): Promise<void> {
        const operation = 'multipart-complete';
        const numbers = new Set<number>();
        if (!parts.length) throw new StorageError({ reason: 'invalid-request', operation });
        const completed = [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => {
                this.validatePartNumber(part.partNumber, operation, 'invalid-request');
                if (!part.etag || numbers.has(part.partNumber)) {
                    throw new StorageError({ reason: 'invalid-request', operation });
                }
                numbers.add(part.partNumber);
                return {
                    PartNumber: part.partNumber,
                    ETag: part.etag,
                    ChecksumSHA256: this.checksumBase64(part.sha256, operation),
                };
            });
        await this.execute(operation, () =>
            this.s3Client.send(
                new CompleteMultipartUploadCommand({
                    Bucket: upload.object.bucket,
                    Key: upload.object.key,
                    UploadId: upload.uploadId,
                    MultipartUpload: { Parts: completed },
                }),
                { abortSignal: options.signal }
            )
        );
    }

    async abortMultipartUpload(
        upload: MultipartUpload,
        options: StorageRequestOptions = {}
    ): Promise<void> {
        await this.execute('multipart-abort', () =>
            this.s3Client.send(
                new AbortMultipartUploadCommand({
                    Bucket: upload.object.bucket,
                    Key: upload.object.key,
                    UploadId: upload.uploadId,
                }),
                { abortSignal: options.signal }
            )
        );
    }

    private presign(
        sign: SignRequest,
        method: PresignedRequest['method'],
        headers: Record<string, string>,
        options: PresignOptions
    ): Promise<PresignedRequest> {
        const expiresIn = options.expiresIn ?? DEFAULT_PRESIGN_EXPIRES;
        if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_PRESIGN_EXPIRES) {
            throw new StorageError({ reason: 'invalid-request', operation: 'presign' });
        }
        const signingDate = new Date();
        signingDate.setMilliseconds(0);
        return this.execute('presign', async () => {
            const signingOptions = {
                expiresIn,
                signingDate,
                signableHeaders: new Set(Object.keys(headers)),
                unhoistableHeaders: new Set(Object.keys(headers)),
            };
            const url = await sign(signingOptions);
            return {
                url,
                method,
                headers,
                expiresAt: new Date(signingDate.getTime() + expiresIn * 1000),
            };
        });
    }

    private checksumBase64(
        value: string | undefined,
        operation: StorageOperation
    ): string | undefined {
        if (value === undefined) return undefined;
        if (!/^[\da-f]{64}$/i.test(value)) {
            throw new StorageError({ reason: 'invalid-request', operation });
        }
        return Buffer.from(value, 'hex').toString('base64');
    }

    private validatePartNumber(
        value: number | undefined,
        operation: StorageOperation,
        reason: 'invalid-request' | 'invalid-response'
    ): asserts value is number {
        if (
            value === undefined ||
            !Number.isInteger(value) ||
            value < 1 ||
            value > MAX_PART_NUMBER
        ) {
            throw new StorageError({ reason, operation });
        }
    }

    private async execute<T>(operation: StorageOperation, run: () => PromiseLike<T>): Promise<T> {
        try {
            const result = await run();
            this.logger.debug({ operation }, 'Storage operation completed');
            return result;
        } catch (error) {
            throw normalizeStorageError(error, operation) ?? error;
        }
    }
}
