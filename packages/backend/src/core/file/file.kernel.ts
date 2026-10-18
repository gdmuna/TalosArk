import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { StorageService, type PresignedRequest } from '@/infra/storage/index.js';
import { FileRepository, assetSnapshot } from './internal/file.repository.js';
import { FileOperations } from './internal/file.operation.js';
import {
    assetSchema,
    beginSchema,
    completeSchema,
    parseFileInput,
    partSchema,
    sessionSchema,
} from './internal/file.input.js';
import { UploadSessionService, uploadSnapshot } from './services/upload-session.service.js';
import { FileReadinessService } from './services/file-readiness.service.js';
import { FileCleanupService } from './services/file-cleanup.service.js';
import { FILE_OPTIONS, type ResolvedFileOptions } from './file.options.js';
import { FileError } from './file.error.js';
import type {
    BeginFileUpload,
    CompleteFileUpload,
    FileAssetRequest,
    FileAssetSnapshot,
    FileCleanupResult,
    FileDownload,
    FilePartRequest,
    FileUploadProgress,
    FileUploadRequest,
    FileUploadSnapshot,
} from './file.contract.js';

@Injectable()
export class FileKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly repository: FileRepository,
        private readonly operations: FileOperations,
        private readonly uploads: UploadSessionService,
        private readonly readiness: FileReadinessService,
        private readonly cleanupService: FileCleanupService,
        private readonly storage: StorageService,
        @Inject(FILE_OPTIONS) private readonly options: ResolvedFileOptions
    ) {}

    beginUpload(input: BeginFileUpload): Promise<FileUploadSnapshot> {
        const value = parseFileInput(beginSchema, input);
        if (
            value.sizeBytes > this.options.maxFileSizeBytes ||
            (value.mode === 'multipart' && value.sizeBytes === 0)
        )
            throw new FileError({ reason: 'invalid-input' });
        return this.run(async (signal) => {
            const row = await this.repository.begin(value);
            signal.throwIfAborted();
            return uploadSnapshot(row);
        });
    }

    signUpload(input: FilePartRequest): Promise<PresignedRequest> {
        const value = parseFileInput(partSchema, input);
        return this.run((signal) => this.uploads.sign(value, signal));
    }

    inspectUpload(input: FileUploadRequest): Promise<FileUploadProgress> {
        const value = parseFileInput(sessionSchema, input);
        return this.run((signal) => this.uploads.progress(value, signal));
    }

    completeUpload(input: CompleteFileUpload): Promise<FileAssetSnapshot> {
        const value = parseFileInput(completeSchema, input);
        return this.run((signal) => this.readiness.complete(value, signal));
    }

    cancelUpload(input: FileUploadRequest): Promise<FileUploadSnapshot> {
        const value = parseFileInput(sessionSchema, input);
        return this.run(async (signal) => {
            const row = await this.repository.cancel(value);
            signal.throwIfAborted();
            return uploadSnapshot(row);
        });
    }

    readAsset(input: FileAssetRequest): Promise<FileAssetSnapshot> {
        const value = parseFileInput(assetSchema, input);
        return this.run(async (signal) => {
            const row = await this.repository.asset(value);
            signal.throwIfAborted();
            return assetSnapshot(row);
        });
    }

    downloadAsset(input: FileAssetRequest): Promise<FileDownload> {
        const value = parseFileInput(assetSchema, input);
        return this.run(async (signal) => {
            const row = await this.repository.asset(value);
            const ttl = row.unboundExpiresAt
                ? Math.floor((row.unboundExpiresAt.getTime() - Date.now()) / 1000)
                : this.options.downloadTtlSeconds;
            if (ttl < 1) throw new FileError({ reason: 'unavailable' });
            const name = encodeURIComponent(row.filename).replace(
                /['()*]/g,
                (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
            );
            signal.throwIfAborted();
            const request = await this.storage.presignDownload(
                { bucket: row.object.bucket, key: row.object.key },
                {
                    expiresIn: Math.min(ttl, this.options.downloadTtlSeconds),
                    contentDisposition: `attachment; filename="download"; filename*=UTF-8''${name}`,
                    contentType: 'application/octet-stream',
                }
            );
            await this.repository.asset(value);
            signal.throwIfAborted();
            return Object.freeze({ asset: assetSnapshot(row), request });
        });
    }

    removeAsset(input: FileAssetRequest): Promise<void> {
        const value = parseFileInput(assetSchema, input);
        return this.run(async (signal) => {
            await this.repository.remove(value);
            signal.throwIfAborted();
        });
    }

    /** Trusted maintenance entry, never an unrestricted user-facing endpoint. No scheduler is implied. */
    cleanup(limit = 50): Promise<FileCleanupResult> {
        const count = parseFileInput(z.number().int().min(1).max(200), limit);
        return this.run((signal) => this.cleanupService.run(count, signal));
    }

    private run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
        if (this.database.transaction.current())
            throw new FileError({ reason: 'transaction-active' });
        return this.operations.run(work);
    }
}
