import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { StorageService, StorageError } from '@/infra/storage/index.js';
import { FileRepository } from '../internal/file.repository.js';
import type { FileCleanupResult } from '../file.contract.js';
import { multipartHandle } from './upload-session.service.js';

@Injectable()
export class FileCleanupService {
    constructor(
        private readonly repository: FileRepository,
        private readonly storage: StorageService,
        @InjectPinoLogger(FileCleanupService.name) private readonly logger: PinoLogger
    ) {}

    async run(limit: number, signal: AbortSignal): Promise<FileCleanupResult> {
        signal.throwIfAborted();
        const expired = await this.repository.expire(limit);
        const failures: { kind: 'session' | 'object'; id: string }[] = [];
        let cleanedSessions = 0,
            cleanedObjects = 0;
        for (const session of await this.repository.cleanupSessions(limit)) {
            signal.throwIfAborted();
            try {
                if (session.multipartUploadId) {
                    try {
                        await this.storage.abortMultipartUpload(multipartHandle(session), {
                            signal,
                        });
                    } catch (error) {
                        if (
                            !StorageError.is(error, 'invalid-multipart') &&
                            !StorageError.is(error, 'not-found')
                        )
                            throw error;
                    }
                }
                await this.storage.deleteObject(
                    { bucket: session.stagingBucket, key: session.stagingKey },
                    { signal }
                );
                cleanedSessions++;
            } catch (error) {
                if (signal.aborted) throw signal.reason;
                if (!StorageError.is(error)) throw error;
                failures.push({ kind: 'session', id: session.id });
                this.logger.warn(
                    { event: 'file.cleanup.failed', sessionId: session.id, err: error },
                    'File upload cleanup failed'
                );
            } finally {
                await this.repository.touchSession(session.id);
            }
        }
        for (const { id } of await this.repository.cleanupObjects(limit)) {
            signal.throwIfAborted();
            const location = await this.repository.retireObject(id);
            signal.throwIfAborted();
            if (!location) continue;
            try {
                await this.storage.deleteObject(location, { signal });
                cleanedObjects++;
            } catch (error) {
                if (signal.aborted) throw signal.reason;
                if (!StorageError.is(error)) throw error;
                failures.push({ kind: 'object', id });
                this.logger.warn(
                    { event: 'file.cleanup.failed', objectId: id, err: error },
                    'File object cleanup failed'
                );
            }
        }
        return Object.freeze({
            expiredUploads: expired.uploads,
            expiredAssets: expired.assets,
            cleanedSessions,
            cleanedObjects,
            failures: Object.freeze(failures.map((value) => Object.freeze(value))),
        });
    }
}
