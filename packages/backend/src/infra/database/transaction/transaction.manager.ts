import { performance } from 'node:perf_hooks';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { monotonicFactory } from 'ulid';
import { Prisma } from '@root/prisma/generated/client.js';
import { DatabaseClient } from '../database.client.js';
import { normalizeDatabaseError } from '../database.error.normalize.js';
import type { DatabaseQueryClient } from '../database.type.js';
import {
    DatabaseTransactionContext,
    type DatabaseTransactionScope,
} from './transaction.context.js';
import { DatabaseTransactionError } from './transaction.error.js';
import type {
    DatabaseAfterCommitCallback,
    DatabaseTransactionInfo,
    DatabaseTransactionOptions,
    DatabaseTransactionPropagation,
} from './transaction.type.js';

@Injectable()
export class DatabaseTransactionManager {
    private readonly nextId = monotonicFactory();
    private readonly clients = new WeakMap<DatabaseTransactionScope, DatabaseQueryClient>();

    constructor(
        private readonly root: DatabaseClient,
        private readonly context: DatabaseTransactionContext,
        @InjectPinoLogger(DatabaseTransactionManager.name) private readonly logger: PinoLogger
    ) {}

    get queryClient(): DatabaseQueryClient {
        const scope = this.context.current();
        if (!scope) return this.root.managed;
        this.assertActive(scope);
        const client = this.clients.get(scope);
        if (!client) {
            throw new DatabaseTransactionError({
                reason: 'context-unbound',
                transactionId: scope.id,
            });
        }
        return client;
    }

    current(): Readonly<DatabaseTransactionInfo> | undefined {
        const scope = this.context.current();
        if (!scope) return undefined;
        this.expire(scope);
        return Object.freeze({
            id: scope.id,
            parentId: scope.parentId,
            propagation: scope.propagation,
            state: scope.state,
            rollbackOnly: scope.rollbackOnly,
            outcome: scope.outcome,
        });
    }

    afterCommit(callback: DatabaseAfterCommitCallback): void {
        const scope = this.context.current();
        if (!scope) throw new DatabaseTransactionError({ reason: 'required' });
        this.assertActive(scope);
        scope.callbacks.push(callback);
    }

    async run<T>(work: () => PromiseLike<T>, options: DatabaseTransactionOptions = {}): Promise<T> {
        const propagation = options.propagation ?? 'required';
        this.validateOptions(options, propagation);
        const parent = this.context.current();
        if (parent) {
            this.assertActive(parent);
            if (propagation !== 'requiresNew') {
                this.assertCompatibleOptions(parent, options);
                try {
                    const result = await work();
                    this.assertActive(parent);
                    return result;
                } catch (error) {
                    this.context.markRollbackOnly(parent, error);
                    throw error;
                }
            }
        } else if (propagation === 'mandatory') {
            throw new DatabaseTransactionError({ reason: 'required' });
        }

        const scope: DatabaseTransactionScope = {
            id: this.nextId(),
            parentId: parent?.id,
            propagation,
            state: 'active',
            rollbackOnly: false,
            callbacks: [],
            options: {
                maxWait: options.maxWait ?? 2_000,
                timeout: options.timeout ?? 5_000,
                isolationLevel: options.isolationLevel,
            },
        };
        let result: T;
        try {
            result = await this.root.managed.$transaction(async (client) => {
                scope.deadline = performance.now() + scope.options.timeout;
                const timer = setTimeout(() => this.expire(scope), scope.options.timeout);
                timer.unref();
                this.clients.set(scope, client);
                try {
                    return await this.context.run(scope, async () => {
                        const value = await work();
                        this.assertActive(scope);
                        if (scope.rollbackOnly) {
                            throw new DatabaseTransactionError(
                                { reason: 'rollback-only', transactionId: scope.id },
                                { cause: scope.rollbackCause }
                            );
                        }
                        return value;
                    });
                } finally {
                    clearTimeout(timer);
                    if (scope.state === 'active') scope.state = 'finishing';
                    this.clients.delete(scope);
                }
            }, scope.options);
            scope.outcome = 'committed';
        } catch (error) {
            scope.outcome = 'unconfirmed';
            scope.callbacks.length = 0;
            throw normalizeDatabaseError(error);
        } finally {
            scope.state = 'closed';
            this.clients.delete(scope);
        }

        await this.context.without(async () => {
            for (const callback of scope.callbacks.splice(0)) {
                try {
                    await callback();
                } catch (error) {
                    try {
                        this.logger.error(
                            { transactionId: scope.id, err: error },
                            'After-commit callback failed'
                        );
                    } catch {
                        try {
                            process.stderr.write(
                                'After-commit callback failed; logger unavailable\n'
                            );
                        } catch {
                            // Diagnostic failure cannot change an already committed result.
                        }
                    }
                }
            }
        });
        return result;
    }

    private assertActive(scope: DatabaseTransactionScope): void {
        this.expire(scope);
        if (scope.state !== 'active') {
            throw new DatabaseTransactionError({
                reason: 'context-closed',
                transactionId: scope.id,
            });
        }
    }

    private expire(scope: DatabaseTransactionScope): void {
        if (
            scope.state === 'active' &&
            scope.deadline !== undefined &&
            performance.now() >= scope.deadline
        ) {
            scope.state = 'closed';
            scope.outcome = 'unconfirmed';
            scope.callbacks.length = 0;
            this.clients.delete(scope);
        }
    }

    private assertCompatibleOptions(
        scope: DatabaseTransactionScope,
        options: DatabaseTransactionOptions
    ): void {
        for (const option of ['maxWait', 'timeout', 'isolationLevel'] as const) {
            if (options[option] !== undefined && options[option] !== scope.options[option]) {
                throw new DatabaseTransactionError({
                    reason: 'options-conflict',
                    transactionId: scope.id,
                    option,
                });
            }
        }
    }

    private validateOptions(
        options: DatabaseTransactionOptions,
        propagation: DatabaseTransactionPropagation
    ): void {
        if (!['required', 'mandatory', 'requiresNew'].includes(propagation)) {
            throw new DatabaseTransactionError({
                reason: 'invalid-options',
                option: 'propagation',
            });
        }
        for (const option of ['maxWait', 'timeout'] as const) {
            const value = options[option];
            if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
                throw new DatabaseTransactionError({ reason: 'invalid-options', option });
            }
        }
        if (
            options.isolationLevel !== undefined &&
            !Object.values(Prisma.TransactionIsolationLevel).includes(options.isolationLevel)
        ) {
            throw new DatabaseTransactionError({
                reason: 'invalid-options',
                option: 'isolationLevel',
            });
        }
    }
}
