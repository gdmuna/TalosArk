import { Injectable } from '@nestjs/common';
import { v7 as uuid } from 'uuid';
import { Prisma, type BackgroundJob } from '@root/prisma/generated/client.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { TaskError } from '../task.error.js';
import type { TaskValue } from '../task.types.js';

export const jsonInput = (value: TaskValue): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
    value === null ? Prisma.JsonNull : value;

export interface TaskBacklogSample {
    readonly state: 'PENDING' | 'QUEUED' | 'RUNNING';
    readonly jobs: number;
    readonly oldestReady: Date | null;
}

export const backlogSampleLimit = 10_000;

@Injectable()
export class TaskRepository {
    constructor(readonly database: DatabaseRuntime) {}
    get(id: string) {
        return this.database.queryClient.backgroundJob.findUnique({ where: { id } });
    }

    /** Bounded active metadata; no terminal-history aggregation or borrowed business transaction. */
    backlog(): Promise<TaskBacklogSample[]> {
        return this.database.transaction.run(
            async () => {
                await this.database.queryClient.$executeRaw`SET LOCAL statement_timeout = '500ms'`;
                return this.database.queryClient.$queryRaw<TaskBacklogSample[]>`
                SELECT s.status::text AS state, count(j."availableAt")::int AS jobs,
                    min(j."availableAt") FILTER (
                        WHERE j."availableAt" <= CURRENT_TIMESTAMP
                        AND (j."expiresAt" IS NULL OR j."expiresAt" > CURRENT_TIMESTAMP)
                    ) AS "oldestReady"
                FROM unnest(ARRAY['PENDING','QUEUED','RUNNING']::"BackgroundJobStatus"[]) AS s(status)
                LEFT JOIN LATERAL (
                    SELECT "availableAt", "expiresAt" FROM "BackgroundJob"
                    WHERE status = s.status ORDER BY "availableAt", id LIMIT ${backlogSampleLimit + 1}
                ) AS j ON true GROUP BY s.status
            `;
            },
            { propagation: 'requiresNew', maxWait: 200, timeout: 1000 }
        );
    }

    async claim(limit: number, leaseMs: number): Promise<BackgroundJob[]> {
        const token = uuid();
        return this.database.transaction.run(
            () => this.database.queryClient.$queryRaw<BackgroundJob[]>`
            UPDATE "BackgroundJob" AS j SET "dispatchToken" = ${token}::uuid,
                "dispatchUntil" = clock_timestamp() + ${leaseMs} * interval '1 millisecond',
                "checkAt" = clock_timestamp() + ${leaseMs} * interval '1 millisecond',
                "updatedAt" = clock_timestamp()
            WHERE j.id IN (
                SELECT id FROM "BackgroundJob"
                WHERE status IN ('PENDING', 'QUEUED', 'RUNNING') AND "checkAt" <= clock_timestamp()
                    AND ("dispatchUntil" IS NULL OR "dispatchUntil" <= clock_timestamp())
                ORDER BY "checkAt", id LIMIT ${limit} FOR UPDATE SKIP LOCKED
            ) RETURNING j.*`,
            { isolationLevel: 'ReadCommitted' }
        );
    }

    async release(row: BackgroundJob, delayMs: number, dispatchFailed = false): Promise<void> {
        await this.database.queryClient.backgroundJob.updateMany({
            where: { id: row.id, generation: row.generation, dispatchToken: row.dispatchToken },
            data: {
                dispatchToken: null,
                dispatchUntil: null,
                checkAt: new Date(Date.now() + delayMs),
                ...(dispatchFailed
                    ? { dispatchAttempts: { increment: 1 }, failureCode: 'dispatch.unavailable' }
                    : {}),
            },
        });
    }

    async queued(row: BackgroundJob): Promise<void> {
        await this.database.queryClient.backgroundJob.updateMany({
            where: {
                id: row.id,
                generation: row.generation,
                status: 'PENDING',
                dispatchToken: row.dispatchToken,
            },
            data: { status: 'QUEUED' },
        });
    }

    async terminal(
        row: BackgroundJob,
        status: 'FAILED' | 'NEEDS_REVIEW' | 'EXPIRED',
        code: string
    ): Promise<void> {
        await this.database.queryClient.backgroundJob.updateMany({
            where: {
                id: row.id,
                generation: row.generation,
                dispatchToken: row.dispatchToken,
                status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
                OR: [{ executionUntil: null }, { executionUntil: { lte: new Date() } }],
            },
            data: {
                status,
                failureCode: code,
                finishedAt: new Date(),
                executionToken: null,
                executionUntil: null,
            },
        });
    }

    async start(
        id: string,
        generation: number,
        timeoutMs: number,
        repeatable: boolean,
        maxAttempts: number
    ) {
        return this.database.transaction.run(
            async () => {
                await this.database.queryClient
                    .$queryRaw`SELECT id FROM "BackgroundJob" WHERE id = ${id}::uuid FOR UPDATE`;
                const row = await this.get(id);
                if (
                    !row ||
                    row.generation !== generation ||
                    !['PENDING', 'QUEUED', 'RUNNING'].includes(row.status)
                )
                    return null;
                const now = new Date();
                if (row.availableAt > now) throw new TaskError({ reason: 'invalid-state' });
                if (row.executionUntil && row.executionUntil > now)
                    throw new TaskError({ reason: 'lease-lost' });
                if (row.expiresAt && row.expiresAt <= now) {
                    await this.database.queryClient.backgroundJob.update({
                        where: { id },
                        data: { status: 'EXPIRED', finishedAt: now },
                    });
                    return null;
                }
                if ((row.status === 'RUNNING' && !repeatable) || row.budgetUsed >= maxAttempts) {
                    await this.database.queryClient.backgroundJob.update({
                        where: { id },
                        data: {
                            status: row.status === 'RUNNING' ? 'NEEDS_REVIEW' : 'FAILED',
                            failureCode:
                                row.status === 'RUNNING'
                                    ? 'execution.interrupted'
                                    : 'execution.exhausted',
                            finishedAt: now,
                        },
                    });
                    return null;
                }
                return this.database.queryClient.backgroundJob.update({
                    where: { id },
                    data: {
                        status: 'RUNNING',
                        executionToken: uuid(),
                        executionUntil: new Date(now.getTime() + timeoutMs + 30_000),
                        startedAt: now,
                        attempts: { increment: 1 },
                        budgetUsed: { increment: 1 },
                    },
                });
            },
            { isolationLevel: 'ReadCommitted' }
        );
    }

    async finish(
        row: BackgroundJob,
        status: 'SUCCEEDED' | 'QUEUED' | 'FAILED' | 'NEEDS_REVIEW',
        code?: string,
        result?: TaskValue
    ): Promise<void> {
        const changed = await this.database.queryClient.backgroundJob.updateMany({
            where: {
                id: row.id,
                generation: row.generation,
                status: 'RUNNING',
                executionToken: row.executionToken,
            },
            data: {
                status,
                failureCode: code ?? null,
                finishedAt: status === 'QUEUED' ? null : new Date(),
                executionToken: null,
                executionUntil: null,
                ...(result === undefined ? {} : { result: jsonInput(result) }),
            },
        });
        if (changed.count !== 1) throw new TaskError({ reason: 'lease-lost' });
    }

    async renew(row: BackgroundJob): Promise<boolean> {
        const changed = await this.database.queryClient.backgroundJob.updateMany({
            where: {
                id: row.id,
                generation: row.generation,
                status: 'RUNNING',
                executionToken: row.executionToken,
            },
            data: { executionUntil: new Date(Date.now() + 30_000) },
        });
        return changed.count === 1;
    }

    async prune(before: Date, limit: number): Promise<number> {
        const rows = await this.database.queryClient.backgroundJob.findMany({
            where: { status: { in: ['SUCCEEDED', 'EXPIRED'] }, finishedAt: { lt: before } },
            orderBy: [{ finishedAt: 'asc' }, { id: 'asc' }],
            take: limit,
            select: { id: true },
        });
        const result = await this.database.queryClient.backgroundJob.deleteMany({
            where: {
                id: { in: rows.map((row) => row.id) },
                status: { in: ['SUCCEEDED', 'EXPIRED'] },
                finishedAt: { lt: before },
            },
        });
        return result.count;
    }

    async retry(id: string, note: string): Promise<void> {
        const changed = await this.database.queryClient.backgroundJob.updateMany({
            where: {
                id,
                status: { in: ['FAILED', 'NEEDS_REVIEW'] },
                AND: [
                    { OR: [{ executionUntil: null }, { executionUntil: { lte: new Date() } }] },
                    { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
                ],
            },
            data: {
                status: 'PENDING',
                generation: { increment: 1 },
                budgetUsed: 0,
                checkAt: new Date(),
                availableAt: new Date(),
                failureCode: null,
                dispatchToken: null,
                dispatchUntil: null,
                executionToken: null,
                executionUntil: null,
                finishedAt: null,
                operatorNote: note,
            },
        });
        if (changed.count !== 1) throw new TaskError({ reason: 'invalid-state' });
    }
}
