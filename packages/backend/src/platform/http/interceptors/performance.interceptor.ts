import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { AllConfig } from '@/config/index.js';

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { LoggerExtension } from '../../observability/logger/logger-contribution.decorator.js';
import { performanceLogContribution } from './performance.log.contribution.js';

/**
 * @description 性能监控拦截器
 * - 记录所有 HTTP 请求的响应时间
 * - 当请求耗时超过阈值时记录慢请求日志
 * - 区分成功请求和失败请求的日志级别
 */
@LoggerExtension(performanceLogContribution)
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
    constructor(
        private readonly configService: ConfigService<AllConfig, true>,
        @InjectPinoLogger(PerformanceInterceptor.name) private readonly logger: PinoLogger
    ) {}

    intercept(context: ExecutionContext, next: CallHandler) {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse<FastifyReply>();
        const startTime = performance.now();
        response.raw.once('finish', () => {
            const logContext = this.getContext(context);
            const hasError = response.statusCode >= 400;
            this.logPerformance(logContext, startTime, hasError);
        });
        return next.handle();
    }

    private getContext(context: ExecutionContext) {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<FastifyRequest>();
        const response = ctx.getResponse<FastifyReply>();
        const requestId = String(request.id) || 'unknown';
        const method = request.method;
        const url = request.routeOptions.url;
        const status = response.statusCode;
        const remoteAddress = request.ip || request.socket?.remoteAddress;
        const remotePort = request.socket?.remotePort;
        const version = request.raw.version || 'unknown';

        return {
            requestId,
            version,
            http: {
                method,
                url,
                status,
                remoteAddress: remoteAddress || 'unknown',
                remotePort: remotePort || -1,
            },
        };
    }

    // 记录性能日志
    private logPerformance(logContext: any, startTime: number, hasError: boolean) {
        const { method, url } = logContext.http;
        const duration = Math.round(performance.now() - startTime);
        logContext.http.duration = duration;
        logContext.http.durationUnit = 'ms';
        logContext.http.hasError = hasError;
        logContext.event = hasError ? 'http.request.failed' : 'http.request.completed';

        const SLOW_REQUEST_THRESHOLDS = this.configService.get(
            'observability.slowRequestThreshold',
            { infer: true }
        );

        // 根据耗时和状态码选择日志级别
        if (duration >= SLOW_REQUEST_THRESHOLDS.error) {
            logContext.event = 'http.request.critical';
            // 超过 3 秒：error 级别
            // prettier-ignore
            this.logger.error(logContext, `[${method}](${url}) Critical slow request (${duration}ms)`);
        } else if (duration >= SLOW_REQUEST_THRESHOLDS.warn) {
            logContext.event = 'http.request.slow';
            // 超过 1 秒：warn 级别
            this.logger.warn(logContext, `[${method}](${url}) Slow request (${duration}ms)`);
        } else if (hasError) {
            // 快速异常请求：info 级别
            this.logger.info(logContext, `[${method}](${url}) Request failed (${duration}ms)`);
        } else {
            // 正常快速请求：debug 级别
            this.logger.debug(logContext, `[${method}](${url}) Request completed (${duration}ms)`);
        }
    }
}
