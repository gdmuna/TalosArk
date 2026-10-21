import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TaskRepository } from './internal/task.repository.js';
import { policySchema, taskValue } from './internal/task.input.js';
import { TaskHandlerRegistry } from './task-handler.registry.js';
import { TaskError, TaskFailure } from './task.error.js';

export type TaskExecutionResult = { readonly retry: boolean; readonly code?: string };

@Injectable()
export class TaskExecutor {
    constructor(
        private readonly repository: TaskRepository,
        private readonly handlers: TaskHandlerRegistry,
        @InjectPinoLogger(TaskExecutor.name) private readonly logger: PinoLogger
    ) {}

    async execute(
        id: string,
        generation: number,
        signal: AbortSignal
    ): Promise<TaskExecutionResult> {
        const initial = await this.repository.get(id);
        if (!initial || initial.generation !== generation) return { retry: false };
        const { definition, handler } = this.handlers.require(initial.kind, initial.version);
        const policy = policySchema.parse(initial.policy);
        const payload = definition.input.safeParse(initial.payload);
        const row = await this.repository.start(
            id,
            generation,
            policy.timeoutMs,
            policy.repeatable,
            policy.maxAttempts
        );
        if (!row) return { retry: false };
        const controller = new AbortController();
        const abort = () => controller.abort(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        const timer = setTimeout(
            () => controller.abort(new TaskError({ reason: 'timeout' })),
            policy.timeoutMs
        );
        let effectFinished = false;
        let renewing: Promise<void> | undefined;
        const heartbeat = setInterval(() => {
            if (renewing) return;
            renewing = this.repository
                .renew(row)
                .then(
                    (renewed) => {
                        if (!renewed) controller.abort(new TaskError({ reason: 'lease-lost' }));
                    },
                    () => controller.abort(new TaskError({ reason: 'lease-lost' }))
                )
                .finally(() => {
                    renewing = undefined;
                });
        }, 10_000);
        try {
            if (!payload.success) throw new TaskFailure('permanent', 'input.invalid');
            controller.signal.throwIfAborted();
            // Keep the worker slot and lease until underlying work settles, even after cancellation.
            const output = await handler.execute(payload.data, {
                jobId: id,
                attempt: row.attempts,
                signal: controller.signal,
            });
            effectFinished = true;
            controller.signal.throwIfAborted();
            await this.repository.finish(
                row,
                'SUCCEEDED',
                undefined,
                output === undefined ? undefined : taskValue(output)
            );
            return { retry: false };
        } catch (error) {
            let disposition =
                error instanceof TaskFailure
                    ? error.disposition
                    : policy.repeatable
                      ? 'permanent'
                      : 'unknown';
            let code = error instanceof TaskFailure ? error.code : 'execution.unclassified';
            if (effectFinished) {
                disposition = policy.repeatable ? 'retry' : 'unknown';
                code = 'execution.result-unconfirmed';
            }
            if (controller.signal.aborted) {
                disposition = policy.repeatable ? 'retry' : 'unknown';
                code = TaskError.is(controller.signal.reason, 'timeout')
                    ? 'execution.timeout'
                    : 'execution.interrupted';
            }
            const retry = disposition === 'retry' && row.budgetUsed < policy.maxAttempts;
            this.logger.warn(
                {
                    event: 'task.execution.failed',
                    jobId: id,
                    kind: row.kind,
                    generation,
                    attempt: row.attempts,
                    code,
                    retry,
                    err: error,
                },
                'Background task execution failed'
            );
            await this.repository.finish(
                row,
                disposition === 'unknown' ? 'NEEDS_REVIEW' : retry ? 'QUEUED' : 'FAILED',
                code
            );
            return { retry, code };
        } finally {
            clearTimeout(timer);
            clearInterval(heartbeat);
            await renewing;
            signal.removeEventListener('abort', abort);
        }
    }
}
