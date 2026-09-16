import {
    AppException,
    ValidationFailedException,
    RateLimitException,
    SysUnknownException,
    SysSerializationException,
    SysHttpException,
    ErrorRegistry,
} from '@/platform/errors/index.js';
import { Logger } from '@/platform/observability/index.js';

import { ERROR_REFERENCE_URL } from '@/config/index.js';
import { toKebabCase } from '@/common/utils/index.js';

import { AlsContextAdapter as RequestContextService } from '@/platform/context/als-context.adapter.js';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ZodValidationException, ZodSerializationException } from 'nestjs-zod';
import { ZodError } from 'zod/v4';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * 所有 ExceptionFilter 的抽象基类。
 * 封装"日志 + HTTP 响应"的共同逻辑，子类只需构造 AppException 实例后调用 handle()。
 */
abstract class BaseExceptionFilter implements ExceptionFilter {
    protected abstract readonly logger: Logger;

    constructor(protected readonly requestContextService: RequestContextService) {}

    abstract catch(exception: unknown, host: ArgumentsHost): void;

    protected handle(exception: AppException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest<FastifyRequest>();
        const response = ctx.getResponse<FastifyReply>();

        // 防止双重响应：headers 已发送时直接跳过（Filter 被重入时的安全阀）
        if (response.sent) return;

        const requestContext = this.requestContextService.get() ?? null;

        const logContext = {
            requestId: request.id || 'unknown',
            version: request.raw.version || 'unknown',
            ...(request.jwtClaim && {
                user: {
                    id: request.jwtClaim.sub,
                },
            }),
            metadata: requestContext?.metadata ?? null,
            details: exception.details ?? null,
            error: {
                type: exception.constructor.name,
                code: exception.code,
                status: exception.getStatus(),
            },
        };

        const responseBody = exception.getResponse() as Record<string, unknown>;
        const message = String(responseBody['message'] ?? exception.message);

        // logLevel 来自 @RegisterException meta，无 if-else 链
        if (exception.logLevel === 'fatal' || exception.logLevel === 'error') {
            this.logger[exception.logLevel](logContext, `${message}\n${exception.stack ?? ''}`);
        } else {
            this.logger[exception.logLevel](logContext, message);
        }

        // prettier-ignore
        const docsUrl =
            ErrorRegistry.get(exception.code)?.docsPath
            ?? `${ERROR_REFERENCE_URL}#${toKebabCase(exception.code)}`;

        if (exception.retryAfterMs !== undefined) {
            response.header('Retry-After', Math.ceil(exception.retryAfterMs / 1000));
        }

        response.code((exception as HttpException).getStatus()).send({
            success: false,
            code: exception.code,
            message,
            type: docsUrl,
            timestamp: new Date().toISOString(),
            context: requestContext,
            details: exception.details ?? null,
        });
    }
}

/**
 * 全局兜底 Filter。职责：
 *   - AppException 子类实例：直接交由 handle() 处理（logLevel 已由装饰器声明）
 *   - 未知异常（非 AppException）：包装为 SysUnknownException 后统一处理
 *
 * 注意：Prisma 原始错误应在 DatabaseService 内部就地包装为 DatabaseException，
 * 不应穿透至此。若仍然穿透，会被包装为 SysUnknownException（fatal 级别）。
 */
@Catch()
export class AllExceptionFilter extends BaseExceptionFilter {
    protected readonly logger = new Logger(AllExceptionFilter.name);

    constructor(protected readonly requestContextService: RequestContextService) {
        super(requestContextService);
    }

    catch(exception: unknown, host: ArgumentsHost): void {
        if (exception instanceof AppException) {
            return this.handle(exception, host);
        }

        // NestJS 内置 HttpException（NotFoundException、BadRequestException 等）
        // 不是系统级未知错误，包装为 SysHttpException 后经统一的 handle() 路径处理
        if (exception instanceof HttpException) {
            return this.handle(new SysHttpException(exception), host);
        }

        // 真正未预期的异常：包装为 SysUnknownException，cause 链保留原始错误
        const cause = exception instanceof Error ? exception : new Error(String(exception));
        return this.handle(new SysUnknownException({ cause }), host);
    }
}

/**
 * 专用 Filter：处理 nestjs-zod 抛出的两类异常。
 *   - ZodValidationException：请求体/查询参数校验失败 → ValidationFailedException
 *   - ZodSerializationException：响应 DTO 校验失败 → SysSerializationException
 */
@Catch(ZodValidationException, ZodSerializationException)
export class ZodExceptionFilter extends BaseExceptionFilter {
    protected readonly logger = new Logger(ZodExceptionFilter.name);

    constructor(protected readonly requestContextService: RequestContextService) {
        super(requestContextService);
    }

    catch(
        exception: ZodValidationException | ZodSerializationException,
        host: ArgumentsHost
    ): void {
        if (exception instanceof ZodValidationException) {
            const zodError = exception.getZodError() as ZodError;
            console.log('Zod validation error details:', zodError);
            if (zodError instanceof ZodError) {
                const details = zodError.issues.map((issue) => ({
                    field: issue.path.join('.') || '(root)',
                    message: issue.message,
                    code: issue.code,
                }));
                this.requestContextService.mergeContextMetadata({ validationErrors: details });
                this.handle(new ValidationFailedException({ details }), host);
            } else {
                this.handle(new ValidationFailedException({ cause: exception }), host);
            }
        } else {
            this.handle(new SysSerializationException({ cause: exception }), host);
        }
    }
}

/**
 * 专用 Filter：处理 @nestjs/throttler 抛出的 ThrottlerException。
 * retryAfterMs 目前置为 undefined（ThrottlerException 未提供剩余等待时间）。
 * 若未来 Throttler 版本提供此信息，可在此处填入以自动写入 Retry-After 响应头。
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter extends BaseExceptionFilter {
    protected readonly logger = new Logger(ThrottlerExceptionFilter.name);

    constructor(protected readonly requestContextService: RequestContextService) {
        super(requestContextService);
    }

    catch(_exception: ThrottlerException, host: ArgumentsHost): void {
        // eslint-disable-next-line no-console
        console.log('ThrottlerException:', _exception);
        this.handle(new RateLimitException(), host);
    }
}
