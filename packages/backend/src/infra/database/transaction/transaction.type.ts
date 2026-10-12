import type { Prisma } from '@root/prisma/generated/client.js';

export type DatabaseTransactionPropagation = 'required' | 'mandatory' | 'requiresNew';

export interface DatabaseTransactionOptions {
    propagation?: DatabaseTransactionPropagation;
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
}

export type DatabaseTransactionState = 'active' | 'finishing' | 'closed';

export interface DatabaseTransactionInfo {
    readonly id: string;
    readonly parentId?: string;
    readonly propagation: DatabaseTransactionPropagation;
    readonly state: DatabaseTransactionState;
    readonly rollbackOnly: boolean;
    readonly outcome?: 'committed' | 'unconfirmed';
}

export type DatabaseAfterCommitCallback = () => void | PromiseLike<void>;

export interface DatabaseTransaction {
    run<T>(work: () => PromiseLike<T>, options?: DatabaseTransactionOptions): Promise<T>;
    current(): Readonly<DatabaseTransactionInfo> | undefined;
    afterCommit(callback: DatabaseAfterCommitCallback): void;
}
