import { ConsoleFormatter } from './console.formatter.js';

import { IS_DEV } from '@/config/index.js';

import { Injectable } from '@nestjs/common';
import { Logger as NestLogger } from '@nestjs/common';

export const LOG_LEVEL_ENUM = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'] as const;

export type LOG_LEVEL_ENUM_TYPE = (typeof LOG_LEVEL_ENUM)[number];

/**
 * @description 自定义 Logger 服务，增强日志功能
 * - 提供了 trace、debug、info、warn、error、fatal 等日志级别方法
 * - 在日志输出失败时，自动降级到 console 方法，确保日志不丢失
 * - 可以在日志中添加上下文信息，便于定位问题
 * @example
 * new Logger('Example').info('Operation completed successfully');
 */
@Injectable()
export class Logger extends NestLogger {
    constructor(context: string) {
        super(context);
    }
    private _logger(level: LOG_LEVEL_ENUM_TYPE, message: any, context?: string) {
        try {
            switch (level) {
                case 'verbose':
                    super.verbose(message, context);
                    break;
                case 'debug':
                    super.debug(message, context);
                    break;
                case 'log':
                    super.log(message, context);
                    // throw new Error('Simulated logger error for testing fallback mechanism');
                    break;
                case 'warn':
                    super.warn(message, context);
                    break;
                case 'error':
                    super.error(message, context);
                    // throw new Error('Simulated logger error for testing fallback mechanism');
                    break;
                case 'fatal':
                    super.fatal(message, context);
                    break;
            }
        } catch (err: any) {
            const ctx = this.context;
            const payload = {
                context: ctx ?? 'Logger',
                fallback: true,
                ...(typeof message === 'object' && message !== null ? message : { message }),
            };
            let formatData = ConsoleFormatter.format(level, payload, context);
            if (IS_DEV) formatData = JSON.parse(formatData);
            /* eslint-disable no-console */
            switch (level) {
                case 'verbose':
                    console.debug(formatData);
                    break;
                case 'debug':
                    console.debug(formatData);
                    break;
                case 'log':
                    console.info(formatData);
                    break;
                case 'warn':
                    console.warn(formatData);
                    break;
                case 'error':
                case 'fatal':
                    console.error(formatData);
                    break;
            }
            /* eslint-enable no-console */
            const expectionStack = err.stack ?? 'No stack trace available';
            const selfExpectionPayload = {
                context: 'Logger',
                error: {
                    type: err.constructor?.name ?? 'Unknown',
                    code: err.code ?? 'PINO_LOGGER_EXCEPTION',
                    message: err.message ?? 'Unexpected Logger Error',
                    status: 500,
                },
            };
            let selfExceptionData = ConsoleFormatter.format(
                'error',
                selfExpectionPayload,
                `Internal error\n${expectionStack}`
            );
            if (IS_DEV) selfExceptionData = JSON.parse(selfExceptionData);
            // eslint-disable-next-line no-console
            console.error(selfExceptionData);
        }
    }

    verbose(message: any, context?: string) {
        this._logger('verbose', message, context);
    }

    // trace 作为 verbose 的别名
    trace(message: any, context?: string) {
        this._logger('verbose', message, context);
    }

    debug(message: any, context?: string) {
        this._logger('debug', message, context);
    }

    log(message: any, context?: string) {
        this._logger('log', message, context);
    }

    // info 作为 log 的别名
    info(message: any, context?: string) {
        this._logger('log', message, context);
    }

    warn(message: any, context?: string) {
        this._logger('warn', message, context);
    }

    error(message: any, context?: string) {
        this._logger('error', message, context);
    }

    fatal(message: any, context?: string) {
        this._logger('fatal', message, context);
    }
}
