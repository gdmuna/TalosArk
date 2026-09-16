import { InfraException } from '@/platform/errors/app.exception.js';
import { RegisterException } from '@/platform/errors/exception-registry.js';

export const DatabaseExceptionCode = {
    UNIQUE_VIOLATION: 'DB_UNIQUE_VIOLATION',
    RECORD_NOT_FOUND: 'DB_RECORD_NOT_FOUND',
    QUERY_FAILED: 'DB_QUERY_FAILED',
} as const;

/**
 * 数据库异常中间基类。
 * 所有 Prisma 错误在 DatabaseService 内被捕获后包装为此类的子类，不穿透至 Filter。
 */
export abstract class DatabaseException extends InfraException {}

@RegisterException({
    code: DatabaseExceptionCode.UNIQUE_VIOLATION,
    statusCode: 409,
    message: '数据唯一性约束冲突',
    description: '数据库写入/更新失败：唯一性约束（如主键、唯一索引）已被违反',
    retryable: false,
    logLevel: 'error',
})
export class UniqueViolationException extends DatabaseException {}

@RegisterException({
    code: DatabaseExceptionCode.RECORD_NOT_FOUND,
    statusCode: 404,
    message: '记录不存在',
    description: '数据库查询目标记录不存在或已被删除',
    retryable: false,
    logLevel: 'warn',
})
export class RecordNotFoundException extends DatabaseException {}

@RegisterException({
    code: DatabaseExceptionCode.QUERY_FAILED,
    statusCode: 500,
    message: '数据库查询失败',
    description: '数据库查询执行失败，可能由连接超时、语法错误或事务冲突引起',
    retryable: true,
    logLevel: 'error',
})
export class QueryFailedException extends DatabaseException {}

export default {
    UniqueViolationException,
    RecordNotFoundException,
    QueryFailedException,
};
