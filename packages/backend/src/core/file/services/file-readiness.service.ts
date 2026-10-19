import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { FileUploadSession } from '@root/prisma/generated/client.js';
import { StorageService, StorageError } from '@/infra/storage/index.js';
import { FileRepository, assetSnapshot } from '../internal/file.repository.js';
import { manifestSchema, parseFileInput } from '../internal/file.input.js';
import type { CompleteFileUpload, FileAssetSnapshot, FileUploadPart } from '../file.contract.js';
import { FileError } from '../file.error.js';
import {
    UploadSessionService,
    multipartHandle,
    multipartPartSize,
} from './upload-session.service.js';

@Injectable()
export class FileReadinessService {
    constructor(
        private readonly repository: FileRepository,
        private readonly uploads: UploadSessionService,
        private readonly storage: StorageService
    ) {}

    async complete(input: CompleteFileUpload, signal: AbortSignal): Promise<FileAssetSnapshot> {
        const session = await this.repository.session(input);
        const manifest = this.validateManifest(session, input.parts);
        if (session.status === 'COMPLETED' && session.assetId)
            return assetSnapshot(
                await this.repository.completedAsset({ ...input, assetId: session.assetId })
            );
        return this.uploads.withLease(input, signal, async (current, token) => {
            await this.prepareSource(current, token, manifest, signal);
            const source = { bucket: current.stagingBucket, key: current.stagingKey };
            const stat = await this.storage.statObject(source, { signal }).catch((error) => {
                if (StorageError.is(error, 'not-found'))
                    throw new FileError({ reason: 'not-ready' }, { cause: error });
                throw error;
            });
            if (BigInt(stat.sizeBytes) !== current.expectedSizeBytes)
                throw new FileError({ reason: 'size-mismatch' });
            signal.throwIfAborted();
            const candidate = await this.repository.createCandidate(current, token);
            signal.throwIfAborted();
            await this.storage.copyObject(source, candidate, { signal });
            const body = await this.storage.getObjectStream(candidate, { signal });
            const hash = createHash('sha256');
            let size = 0n;
            try {
                for await (const chunk of body) {
                    signal.throwIfAborted();
                    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    size += BigInt(bytes.length);
                    if (size > current.expectedSizeBytes)
                        throw new FileError({ reason: 'size-mismatch' });
                    hash.update(bytes);
                }
            } finally {
                body.destroy();
            }
            signal.throwIfAborted();
            if (size !== current.expectedSizeBytes)
                throw new FileError({ reason: 'size-mismatch' });
            if (hash.digest('hex') !== current.expectedSha256)
                throw new FileError({ reason: 'checksum-mismatch' });
            return assetSnapshot(await this.repository.publish(input, token, signal));
        });
    }

    private validateManifest(
        session: FileUploadSession,
        parts?: readonly FileUploadPart[]
    ): readonly FileUploadPart[] | undefined {
        if (session.mode === 'SINGLE') {
            if (parts !== undefined) throw new FileError({ reason: 'invalid-parts' });
            return;
        }
        const count = Math.ceil(Number(session.expectedSizeBytes) / multipartPartSize(session));
        if (!parts || parts.length !== count || parts.some((part, i) => part.partNumber !== i + 1))
            throw new FileError({ reason: 'invalid-parts' });
        if (
            session.completionParts &&
            JSON.stringify(parseFileInput(manifestSchema, session.completionParts)) !==
                JSON.stringify(parts)
        )
            throw new FileError({ reason: 'conflict' });
        return parts;
    }

    private async prepareSource(
        session: FileUploadSession,
        token: string,
        parts: readonly FileUploadPart[] | undefined,
        signal: AbortSignal
    ): Promise<void> {
        if (session.mode === 'SINGLE') return;
        const manifest = this.validateManifest(session, parts);
        if (!manifest) throw new FileError({ reason: 'invalid-parts' });
        const partSize = multipartPartSize(session);
        // A previous completion response may have been lost after the provider committed.
        if (session.completionParts) {
            try {
                await this.storage.statObject(
                    { bucket: session.stagingBucket, key: session.stagingKey },
                    { signal }
                );
                return;
            } catch (error) {
                if (!StorageError.is(error, 'not-found')) throw error;
            }
        }
        const handle = multipartHandle(session);
        const uploaded = await this.storage.listMultipartParts(handle, { signal });
        if (
            uploaded.length !== manifest.length ||
            uploaded.some(
                (part, i) =>
                    part.partNumber !== manifest[i].partNumber ||
                    part.etag !== manifest[i].etag ||
                    part.sizeBytes !==
                        Math.min(partSize, Number(session.expectedSizeBytes) - i * partSize)
            )
        )
            throw new FileError({ reason: 'invalid-parts' });
        signal.throwIfAborted();
        await this.repository.saveManifest(session, token, manifest);
        signal.throwIfAborted();
        await this.storage.completeMultipartUpload(handle, manifest, { signal });
    }
}
