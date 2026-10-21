import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { BackgroundJob } from '@root/prisma/generated/client.js';
import { TaskRepository } from '@/core/task/internal/task.repository.js';
import { policySchema } from '@/core/task/internal/task.input.js';
import { TaskHandlerRegistry } from '@/core/task/task-handler.registry.js';
import { TaskError } from '@/core/task/task.error.js';

export interface TaskEnvelope {
    id: string;
    generation: number;
}
export const taskQueueName = 'background';
export const taskQueueId = (row: Pick<BackgroundJob, 'id' | 'generation'>) =>
    `${row.id}-${row.generation}`;

@Injectable()
export class BullmqTaskPublisher {
    constructor(
        private readonly repository: TaskRepository,
        private readonly handlers: TaskHandlerRegistry
    ) {}

    async dispatch(queue: Queue<TaskEnvelope>, row: BackgroundJob): Promise<void> {
        const policy = policySchema.parse(row.policy);
        try {
            this.handlers.require(row.kind, row.version);
        } catch (error) {
            if (!TaskError.is(error, 'unknown-handler')) throw error;
            await this.repository.terminal(row, 'NEEDS_REVIEW', 'handler.unavailable');
            await this.repository.release(row, 30_000);
            return;
        }
        const id = taskQueueId(row);
        const existing = await queue.getJob(id);
        if (existing) {
            const state = await existing.getState();
            if (state === 'failed' || state === 'completed')
                await this.repository.terminal(
                    row,
                    !policy.repeatable && (state === 'completed' || row.status === 'RUNNING')
                        ? 'NEEDS_REVIEW'
                        : 'FAILED',
                    state === 'completed' ? 'execution.result-missing' : 'execution.queue-failed'
                );
            await this.repository.release(row, 30_000);
            return;
        }
        if (row.executionUntil && row.executionUntil > new Date()) {
            await this.repository.release(row, 30_000);
            return;
        }
        if (row.expiresAt && row.expiresAt <= new Date()) {
            await this.repository.terminal(row, 'EXPIRED', 'execution.expired');
            await this.repository.release(row, 30_000);
            return;
        }
        if (
            (row.status === 'RUNNING' && !policy.repeatable) ||
            row.budgetUsed >= policy.maxAttempts
        ) {
            await this.repository.terminal(
                row,
                row.status === 'RUNNING' ? 'NEEDS_REVIEW' : 'FAILED',
                'execution.interrupted'
            );
            await this.repository.release(row, 30_000);
            return;
        }
        // Set QUEUED first: a worker may consume immediately after Redis accepts add().
        await this.repository.queued(row);
        await queue.add(
            row.kind,
            { id: row.id, generation: row.generation },
            {
                jobId: id,
                attempts: Math.max(1, policy.maxAttempts - row.budgetUsed),
                backoff: { ...policy.backoff, jitter: 0.2 },
                delay: Math.max(0, row.availableAt.getTime() - Date.now()),
                removeOnComplete: { age: 86400, count: 1000 },
                removeOnFail: { age: 7 * 86400, count: 1000 },
                stackTraceLimit: 0,
            }
        );
        await this.repository.release(row, 30_000);
    }
}
