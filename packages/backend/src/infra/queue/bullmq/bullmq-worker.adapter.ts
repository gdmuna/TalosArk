import { Injectable } from '@nestjs/common';
import { Job, UnrecoverableError, DelayedError } from 'bullmq';
import { ulid } from 'ulid';
import { TaskExecutor } from '@/core/task/task.executor.js';
import { TaskError } from '@/core/task/task.error.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import type { TaskEnvelope } from './bullmq-task-publisher.js';

@Injectable()
export class BullmqWorkerAdapter {
    constructor(
        private readonly executor: TaskExecutor,
        private readonly context: AlsContextAdapter
    ) {}

    async execute(job: Job<TaskEnvelope>, signal: AbortSignal, token?: string): Promise<void> {
        const { id, generation } = job.data;
        if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(generation) || generation < 1)
            throw new UnrecoverableError('Invalid background task envelope');
        let result: Awaited<ReturnType<TaskExecutor['execute']>>;
        try {
            result = await this.context.run(
                {
                    requestId: ulid(),
                    time: Date.now(),
                    metadata: { jobId: id, generation },
                },
                () => this.executor.execute(id, generation, signal)
            );
        } catch (error) {
            if (TaskError.is(error, 'lease-lost') && token) {
                // A prior local attempt may still be settling. Do not consume a retry budget.
                await job.moveToDelayed(Date.now() + 5000, token);
                throw new DelayedError();
            }
            // BullMQ stores this message in Redis. Never pass arbitrary owner/vendor errors through.
            // eslint-disable-next-line preserve-caught-error -- Queue persistence must exclude vendor causes and payloads.
            throw new Error('execution.infrastructure-unavailable');
        }
        if (result.code) {
            if (result.retry) throw new Error(result.code);
            throw new UnrecoverableError(result.code);
        }
    }
}
