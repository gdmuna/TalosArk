import { RequestError } from '@/platform/request/request.error.js';
import type { AllConfig } from '@/config/index.js';

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * @description 请求超时拦截器
 * - 限制请求处理时间不超过配置的阈值
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
    private readonly timeoutMs: number;

    constructor(private readonly configService: ConfigService<AllConfig, true>) {
        this.timeoutMs = this.configService.get('http.requestTimeoutMs', {
            infer: true,
        });
    }

    intercept(_: ExecutionContext, next: CallHandler) {
        return next.handle().pipe(
            timeout(this.timeoutMs),
            catchError((err) => {
                if (err instanceof TimeoutError) {
                    return throwError(
                        () => new RequestError({ reason: 'processingTimeout' }, { cause: err })
                    );
                }
                return throwError(() => err);
            })
        );
    }
}
