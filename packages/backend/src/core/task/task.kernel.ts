import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { TaskRepository, jsonInput } from './internal/task.repository.js';
import { TaskHandlerRegistry } from './task-handler.registry.js';
import { TaskError } from './task.error.js';
import { taskValue } from './internal/task.input.js';
import type { TaskDefinition, TaskEnqueueOptions } from './task.types.js';

@Injectable()
export class TaskKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly repository: TaskRepository,
        private readonly handlers: TaskHandlerRegistry
    ) {}

    enqueue<T>(definition: TaskDefinition<T>, payload: T, options: TaskEnqueueOptions = {}) {
        return this.database.transaction.run(
            async () => {
                const registered = this.handlers.require(definition.kind, definition.version);
                const parsed = registered.definition.input.safeParse(payload);
                const now = new Date();
                const availableAt = options.availableAt ?? now;
                if (
                    !parsed.success ||
                    !Number.isFinite(availableAt.getTime()) ||
                    (options.expiresAt &&
                        (!Number.isFinite(options.expiresAt.getTime()) ||
                            options.expiresAt <= availableAt)) ||
                    (options.sourceRequestId &&
                        !/^[a-zA-Z0-9_.-]{1,100}$/.test(options.sourceRequestId))
                )
                    throw new TaskError({ reason: 'invalid-input' });
                return this.database.queryClient.backgroundJob.create({
                    data: {
                        kind: definition.kind,
                        version: definition.version,
                        payload: jsonInput(taskValue(parsed.data)),
                        policy: jsonInput(taskValue(registered.definition.policy)),
                        availableAt,
                        checkAt: availableAt,
                        expiresAt: options.expiresAt,
                        sourceRequestId: options.sourceRequestId,
                    },
                    select: { id: true, kind: true, version: true, status: true, createdAt: true },
                });
            },
            { propagation: 'mandatory' }
        );
    }

    async inspect(id: string) {
        if (!/^[0-9a-f-]{36}$/i.test(id)) throw new TaskError({ reason: 'invalid-input' });
        const row = await this.repository.get(id);
        if (!row) return null;
        const {
            payload: _payload,
            dispatchToken: _dispatch,
            executionToken: _execution,
            ...snapshot
        } = row;
        return snapshot;
    }

    async listFailures(limit = 50) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 200)
            throw new TaskError({ reason: 'invalid-input' });
        return this.database.queryClient.backgroundJob.findMany({
            where: { status: { in: ['FAILED', 'NEEDS_REVIEW'] } },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: limit,
            select: {
                id: true,
                kind: true,
                version: true,
                status: true,
                attempts: true,
                generation: true,
                failureCode: true,
                updatedAt: true,
            },
        });
    }

    async retry(id: string, note: string): Promise<void> {
        const row = await this.inspect(id);
        if (
            !row ||
            !note.trim() ||
            note.length > 500 ||
            (row.expiresAt && row.expiresAt <= new Date())
        )
            throw new TaskError({ reason: 'invalid-input' });
        this.handlers.require(row.kind, row.version);
        await this.repository.retry(id, note);
    }
}
