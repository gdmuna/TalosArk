import { DriverAdapterError } from '@prisma/driver-adapter-utils';
import { Prisma } from '@root/prisma/generated/client.js';
import { DatabaseError, type DatabaseFailure } from './database.error.js';

/** Normalize only recognized SDK errors; business and programming errors retain identity. */
export function normalizeDatabaseError(error: unknown): unknown {
    if (DatabaseError.is(error)) return error;
    let driver: Record<string, unknown> | undefined;
    let model: string | undefined;
    let code: string | undefined;
    let target: unknown;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const adapter = error.meta?.driverAdapterError;
        driver = isRecord(adapter) && isRecord(adapter.cause) ? adapter.cause : undefined;
        model = string(error.meta?.modelName);
        code = error.code;
        target = error.meta?.target;
    } else if (error instanceof DriverAdapterError) {
        driver = error.cause;
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
        return new DatabaseError(
            { reason: prismaReason(error.errorCode) ?? 'configuration' },
            { cause: error }
        );
    } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
        return new DatabaseError({ reason: 'query-failed' }, { cause: error });
    } else {
        return error;
    }
    const details = driverDetails(driver);
    if (
        code === 'P2002' ||
        driver?.kind === 'UniqueConstraintViolation' ||
        details.sqlState === '23505'
    ) {
        const constraint = isRecord(driver?.constraint) ? driver.constraint : undefined;
        return new DatabaseError(
            {
                ...details,
                model,
                reason: 'unique-constraint',
                fields: stringArray(constraint?.fields) ?? stringArray(target) ?? [],
                constraint: string(constraint?.index) ?? string(target),
            },
            { cause: error }
        );
    }
    const reason = driverReason(driver) ?? prismaReason(code) ?? 'query-failed';
    return new DatabaseError({ ...details, model, reason }, { cause: error });
}

type GeneralReason = Exclude<DatabaseFailure['reason'], 'unique-constraint'>;

function prismaReason(code: string | undefined): GeneralReason | undefined {
    if (code === 'P2025') return 'record-not-found';
    if (code === 'P2034') return 'transaction-conflict';
    if (code && ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(code)) return 'unavailable';
    return undefined;
}

function driverReason(driver: Record<string, unknown> | undefined): GeneralReason | undefined {
    if (!driver) return undefined;
    if (driver.kind === 'TransactionWriteConflict') return 'transaction-conflict';
    if (
        [
            'DatabaseNotReachable',
            'ConnectionClosed',
            'SocketTimeout',
            'TooManyConnections',
        ].includes(String(driver.kind))
    )
        return 'unavailable';
    if (
        [
            'AuthenticationFailed',
            'DatabaseAccessDenied',
            'DatabaseDoesNotExist',
            'TlsConnectionError',
        ].includes(String(driver.kind))
    )
        return 'configuration';
    const sqlState = string(driver.originalCode) ?? string(driver.code);
    if (sqlState === '40001' || sqlState === '40P01') return 'transaction-conflict';
    if (
        sqlState?.startsWith('08') ||
        ['53300', '57P01', '57P02', '57P03'].includes(sqlState ?? '')
    ) {
        return 'unavailable';
    }
    return undefined;
}

function driverDetails(driver: Record<string, unknown> | undefined) {
    return {
        table: string(driver?.table),
        schema: string(driver?.schema),
        sqlState: string(driver?.originalCode) ?? string(driver?.code),
    };
}

function string(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
        ? value
        : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
