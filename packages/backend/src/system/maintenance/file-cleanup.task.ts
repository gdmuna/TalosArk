import { Injectable, Module } from '@nestjs/common';
import { z } from 'zod';
import { FileKernel, FileModule, FileError } from '@/core/file/index.js';
import {
    TaskHandlerExtension,
    TaskFailure,
    type TaskDefinition,
    type TaskHandler,
    type TaskContext,
} from '@/core/task/index.js';

export const fileCleanupTask = Object.freeze({
    kind: 'file.cleanup',
    version: 1,
    input: z.strictObject({ limit: z.number().int().min(1).max(200) }),
    policy: {
        maxAttempts: 3,
        timeoutMs: 120_000,
        backoff: { type: 'exponential', delay: 10_000 },
        repeatable: true,
    },
} satisfies TaskDefinition<{ limit: number }>);

@Injectable()
@TaskHandlerExtension(fileCleanupTask)
export class FileCleanupTaskHandler implements TaskHandler<{ limit: number }> {
    constructor(private readonly file: FileKernel) {}
    async execute(payload: { limit: number }, context: TaskContext) {
        try {
            const result = await this.file.cleanup(payload.limit, context.signal);
            if (result.failures.length)
                throw new TaskFailure('retry', 'file.cleanup.partial-failure');
            return {
                expiredUploads: result.expiredUploads,
                expiredAssets: result.expiredAssets,
                cleanedSessions: result.cleanedSessions,
                cleanedObjects: result.cleanedObjects,
            };
        } catch (error) {
            if (FileError.is(error, 'busy') || FileError.is(error, 'storage-unavailable'))
                throw new TaskFailure('retry', 'file.cleanup.unavailable');
            throw error;
        }
    }
}

@Module({ imports: [FileModule], providers: [FileCleanupTaskHandler] })
export class MaintenanceModule {}
