import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v7 as uuid } from 'uuid';
import type { FileUploadSession } from '@root/prisma/generated/client.js';
import { StorageService, type MultipartUpload } from '@/infra/storage/index.js';
import { StorageError } from '@/infra/storage/index.js';
import { DatabaseError } from '@/infra/database/database.error.js';
import { FileRepository } from '../internal/file.repository.js';
import { FILE_OPTIONS, type ResolvedFileOptions } from '../file.options.js';
import { FileError } from '../file.error.js';
import type { FileUploadRequest, FileUploadSnapshot, FilePartRequest } from '../file.contract.js';
import { manifestSchema, parseFileInput } from '../internal/file.input.js';

export function uploadSnapshot(session: FileUploadSession): FileUploadSnapshot {
    return Object.freeze({
        id: session.id,
        status:
            session.status === 'OPEN' && session.expiresAt <= new Date()
                ? 'expired'
                : session.status === 'OPEN' && session.completionParts
                  ? 'finalizing'
                  : (session.status.toLowerCase() as FileUploadSnapshot['status']),
        mode: session.mode === 'SINGLE' ? 'single' : 'multipart',
        filename: session.filename,
        contentType: session.contentType,
        sizeBytes: session.expectedSizeBytes.toString(),
        expiresAt: session.expiresAt,
        assetId: session.assetId,
        partSizeBytes: session.partSizeBytes,
        partCount: session.partSizeBytes
            ? Math.ceil(Number(session.expectedSizeBytes) / session.partSizeBytes)
            : 1,
        completionParts: session.completionParts
            ? Object.freeze(
                  parseFileInput(manifestSchema, session.completionParts).map((part) =>
                      Object.freeze(part)
                  )
              )
            : null,
        purpose:
            session.purposeKey && session.resourceId
                ? Object.freeze({ purposeKey: session.purposeKey, resourceId: session.resourceId })
                : null,
    });
}

export function multipartHandle(session: FileUploadSession): MultipartUpload {
    if (!session.multipartUploadId) throw new FileError({ reason: 'not-ready' });
    return {
        object: { bucket: session.stagingBucket, key: session.stagingKey },
        uploadId: session.multipartUploadId,
    };
}

export function multipartPartSize(session: FileUploadSession): number {
    if (session.mode !== 'MULTIPART' || !session.partSizeBytes)
        throw new FileError({ reason: 'invalid-state' });
    return session.partSizeBytes;
}

@Injectable()
export class UploadSessionService {
    constructor(
        private readonly repository: FileRepository,
        private readonly storage: StorageService,
        @Inject(FILE_OPTIONS) private readonly options: ResolvedFileOptions,
        @InjectPinoLogger(UploadSessionService.name) private readonly logger: PinoLogger
    ) {}

    async withLease<T>(
        input: FileUploadRequest,
        signal: AbortSignal,
        work: (session: FileUploadSession, token: string) => Promise<T>
    ): Promise<T> {
        const token = uuid();
        const session = await this.repository.claim(input, token);
        let result: T;
        try {
            signal.throwIfAborted();
            result = await work(session, token);
        } catch (error) {
            await this.releaseLease(session.id, token);
            throw error;
        }
        await this.releaseLease(session.id, token);
        return result;
    }

    private async releaseLease(id: string, token: string): Promise<void> {
        try {
            await this.repository.release(id, token);
        } catch (error) {
            if (!DatabaseError.is(error)) throw error;
            this.logger.warn(
                { event: 'file.lease-release.failed', sessionId: id, err: error },
                'File upload lease release failed; the lease will expire'
            );
        }
    }

    async sign(input: FilePartRequest, signal: AbortSignal) {
        return this.withLease(input, signal, async (session, token) => {
            if (session.completionParts) throw new FileError({ reason: 'invalid-state' });
            const expiresIn = this.expiry(session);
            if (session.mode === 'SINGLE') {
                if (input.partNumber !== undefined)
                    throw new FileError({ reason: 'invalid-parts' });
                const request = await this.storage.presignUpload(
                    { bucket: session.stagingBucket, key: session.stagingKey },
                    {
                        expiresIn,
                        contentType: session.contentType,
                        sha256: session.expectedSha256,
                    }
                );
                signal.throwIfAborted();
                return request;
            }
            const count = Math.ceil(Number(session.expectedSizeBytes) / multipartPartSize(session));
            if (!input.partNumber || input.partNumber > count)
                throw new FileError({ reason: 'invalid-parts' });
            const handle = await this.ensureMultipart(session, token, signal);
            const request = await this.storage.presignMultipartPart(handle, input.partNumber, {
                expiresIn: this.expiry(session),
            });
            signal.throwIfAborted();
            return request;
        });
    }

    async progress(input: FileUploadRequest, signal: AbortSignal) {
        const session = await this.repository.session(input);
        if (session.status !== 'OPEN' || session.mode === 'SINGLE' || session.completionParts)
            return Object.freeze({ session: uploadSnapshot(session), parts: Object.freeze([]) });
        return this.withLease(input, signal, async (current, token) => {
            const handle = await this.ensureMultipart(current, token, signal);
            const parts = await this.storage.listMultipartParts(handle, { signal });
            return Object.freeze({
                session: uploadSnapshot(current),
                parts: Object.freeze(
                    parts.map((part) =>
                        Object.freeze({
                            partNumber: part.partNumber,
                            etag: part.etag,
                            sizeBytes: part.sizeBytes,
                        })
                    )
                ),
            });
        });
    }

    private async ensureMultipart(
        session: FileUploadSession,
        token: string,
        signal: AbortSignal
    ): Promise<MultipartUpload> {
        if (session.multipartUploadId) return multipartHandle(session);
        const upload = await this.storage.createMultipartUpload(
            { bucket: session.stagingBucket, key: session.stagingKey },
            { contentType: session.contentType, signal }
        );
        try {
            signal.throwIfAborted();
            await this.repository.saveUploadId(session.id, token, upload.uploadId);
        } catch (error) {
            // A known unrecorded handle is compensated; unknown/lost responses require bucket lifecycle cleanup.
            try {
                await this.storage.abortMultipartUpload(upload, {
                    signal: AbortSignal.timeout(5000),
                });
            } catch (cleanupError) {
                if (!StorageError.is(cleanupError)) throw cleanupError;
                this.logger.warn(
                    { event: 'file.multipart-orphan', sessionId: session.id },
                    'Unrecorded multipart upload requires staging lifecycle cleanup'
                );
            }
            throw error;
        }
        return upload;
    }

    private expiry(session: FileUploadSession): number {
        const seconds = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
        if (seconds < 1) throw new FileError({ reason: 'expired' });
        return Math.min(seconds, this.options.presignTtlSeconds);
    }
}
