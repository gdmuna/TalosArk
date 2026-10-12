import type { PrismaClient } from '@root/prisma/generated/client.js';
import { DatabaseError } from './database.error.js';
import { normalizeDatabaseError } from './database.error.normalize.js';
import type { DatabaseTransactionContext } from './transaction/transaction.context.js';

export function createDatabaseQueryClient(
    client: PrismaClient,
    context: DatabaseTransactionContext
) {
    return client.$extends({
        name: 'database-query',
        query: {
            async $allOperations({ args, query }) {
                const scope = context.current();
                try {
                    return await query(args);
                } catch (error) {
                    const normalized = normalizeDatabaseError(error);
                    // Missing records are Prisma control flow, not a failed SQL statement.
                    if (
                        DatabaseError.is(normalized) &&
                        normalized.failure.reason !== 'record-not-found'
                    ) {
                        context.markRollbackOnly(scope, normalized);
                    }
                    throw normalized;
                }
            },
        },
    });
}
