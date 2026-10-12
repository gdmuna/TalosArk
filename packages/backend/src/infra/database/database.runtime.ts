import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@root/prisma/generated/client.js';
import { DatabaseClient } from './database.client.js';
import type { DatabaseQueryClient } from './database.type.js';
import { DatabaseTransactionManager } from './transaction/transaction.manager.js';
import type { DatabaseTransaction } from './transaction/transaction.type.js';

@Injectable()
export class DatabaseRuntime {
    readonly transaction: DatabaseTransaction;

    constructor(
        private readonly root: DatabaseClient,
        private readonly transactions: DatabaseTransactionManager
    ) {
        this.transaction = transactions;
    }

    /** Native escape hatch; queries here deliberately bypass transaction context. */
    get client(): PrismaClient {
        return this.root.client;
    }

    get queryClient(): DatabaseQueryClient {
        return this.transactions.queryClient;
    }
}
