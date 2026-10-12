import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type {
    DatabaseAfterCommitCallback,
    DatabaseTransactionInfo,
    DatabaseTransactionOptions,
} from './transaction.type.js';

export interface DatabaseTransactionScope {
    id: string;
    parentId?: string;
    propagation: DatabaseTransactionInfo['propagation'];
    state: DatabaseTransactionInfo['state'];
    outcome?: DatabaseTransactionInfo['outcome'];
    options: {
        maxWait: number;
        timeout: number;
        isolationLevel?: DatabaseTransactionOptions['isolationLevel'];
    };
    deadline?: number;
    rollbackOnly: boolean;
    rollbackCause?: unknown;
    callbacks: DatabaseAfterCommitCallback[];
}

/** Private transaction propagation, independent of request ALS and its cloned metadata. */
@Injectable()
export class DatabaseTransactionContext {
    private readonly storage = new AsyncLocalStorage<DatabaseTransactionScope | undefined>();

    current(): DatabaseTransactionScope | undefined {
        return this.storage.getStore();
    }

    run<T>(scope: DatabaseTransactionScope, work: () => T): T {
        return this.storage.run(scope, work);
    }

    without<T>(work: () => T): T {
        return this.storage.run(undefined, work);
    }

    markRollbackOnly(scope: DatabaseTransactionScope | undefined, cause: unknown): void {
        if (!scope || scope.state !== 'active') return;
        if (!scope.rollbackOnly) scope.rollbackCause = cause;
        scope.rollbackOnly = true;
    }
}
