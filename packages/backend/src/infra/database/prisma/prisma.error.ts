import { Prisma } from '@root/prisma/generated/client.js';

// prettire-ignore
export type DatabaseFailure =
    | {
          reason: 'unique-constraint';
          model?: string;
          fields: readonly string[];
          constraint?: string;
      }
    | {
          reason:
              | 'record-not-found'
              | 'transaction-conflict'
              | 'unavailable'
              | 'configuration'
              | 'query-failed';
      };

export class DatabaseError extends Error {
    constructor(
        readonly failure: DatabaseFailure,
        options?: ErrorOptions
    ) {
        super(`Database operation failed: ${failure.reason}`, options);
        this.name = 'DatabaseError';
    }
}

export function normalizeDatabaseError(error: unknown): DatabaseError | undefined {
    if (error instanceof DatabaseError) return error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            const target = error.meta?.target;
            const adapter = error.meta?.driverAdapterError;
            const adapterCause =
                isRecord(adapter) && isRecord(adapter.cause) ? adapter.cause : undefined;
            const constraint = isRecord(adapterCause?.constraint)
                ? adapterCause.constraint
                : undefined;
            const fields = Array.isArray(target) ? target : constraint?.fields;
            return new DatabaseError(
                {
                    reason: 'unique-constraint',
                    model:
                        typeof adapterCause?.table === 'string'
                            ? adapterCause.table
                            : typeof error.meta?.modelName === 'string'
                              ? error.meta.modelName
                              : undefined,
                    fields:
                        Array.isArray(fields) && fields.every((field) => typeof field === 'string')
                            ? fields
                            : [],
                    constraint:
                        typeof target === 'string'
                            ? target
                            : typeof constraint?.index === 'string'
                              ? constraint.index
                              : undefined,
                },
                { cause: error }
            );
        }
        const reason =
            error.code === 'P2025'
                ? 'record-not-found'
                : error.code === 'P2034'
                  ? 'transaction-conflict'
                  : ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error.code)
                    ? 'unavailable'
                    : 'query-failed';
        return new DatabaseError({ reason }, { cause: error });
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
        const reason = ['P1001', 'P1002', 'P1008', 'P1017'].includes(error.errorCode ?? '')
            ? 'unavailable'
            : 'configuration';
        return new DatabaseError({ reason }, { cause: error });
    }
    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
        return new DatabaseError({ reason: 'query-failed' }, { cause: error });
    }
    return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
