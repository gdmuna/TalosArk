import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { TaskToolModule } from './task.module.js';
import { TaskKernel } from '../../src/core/task/index.js';
import { TaskHandlerRegistry } from '../../src/core/task/task-handler.registry.js';
import { DatabaseRuntime } from '../../src/infra/database/database.runtime.js';
import { fileCleanupTask } from '../../src/system/maintenance/file-cleanup.task.js';
import { TaskRepository } from '../../src/core/task/internal/task.repository.js';
import type { AllConfig } from '../../src/config/index.js';
import { BullmqRuntime } from '../../src/infra/queue/bullmq/index.js';

export interface TaskInput {
    action: string;
    limit: number;
    id?: string;
    note?: string;
}
export async function execute(input: TaskInput): Promise<void> {
    const app = await NestFactory.createApplicationContext(
        await TaskToolModule.forAction(input.action),
        {
            bufferLogs: true,
            abortOnError: false,
        }
    );
    app.useLogger(app.get(Logger));
    try {
        app.get(TaskHandlerRegistry).initialize();
        const task = app.get(TaskKernel);
        const database = app.get(DatabaseRuntime);
        switch (input.action) {
            case 'failures':
                console.info(JSON.stringify(await task.listFailures(input.limit), null, 2));
                break;
            case 'inspect':
                if (!input.id) throw new Error('Task ID is required for inspect.');
                console.info(JSON.stringify(await task.inspect(input.id), null, 2));
                break;
            case 'retry':
                if (!input.id || !input.note)
                    throw new Error('Task ID and note are required for retry.');
                await task.retry(input.id, input.note);
                break;
            case 'file-cleanup': {
                const receipt = await database.transaction.run(() =>
                    task.enqueue(fileCleanupTask, { limit: input.limit })
                );
                console.info(JSON.stringify(receipt));
                break;
            }
            case 'prune': {
                const options = app
                    .get(ConfigService<AllConfig, true>)
                    .get('queue', { infer: true });
                console.info(
                    JSON.stringify({
                        deleted: await app
                            .get(TaskRepository)
                            .prune(
                                new Date(Date.now() - options.retentionDays * 86400_000),
                                options.batchSize
                            ),
                    })
                );
                break;
            }
            case 'recover': {
                const runtime = app.get(BullmqRuntime);
                try {
                    await runtime.start(false);
                    await runtime.tick();
                } finally {
                    await runtime.stop();
                }
                break;
            }
            default:
                throw new Error('Unknown task operation.');
        }
    } finally {
        await app.close();
    }
}
