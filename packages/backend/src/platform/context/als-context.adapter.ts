import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import merge from 'lodash/merge.js';
import cloneDeep from 'lodash/cloneDeep.js';

/**
 * 请求上下文接口，用于在异步调用链中传递请求级别的上下文信息。
 * 通过 AsyncLocalStorage 维护请求隔离，避免请求间数据混淆。
 */
export interface AlsExecutionContext {
    requestId: string;
    userId?: string;
    version?: string;
    time: number;
    metadata?: Record<string, any>;
}

/**
 * 请求上下文服务，提供请求级别的上下文管理。
 *
 * 基于 Node.js AsyncLocalStorage 实现，确保在异步调用链中正确隔离和访问请求上下文。
 * 适用于中间件、拦截器、守卫等组件中传递请求相关的信息（如用户 ID、请求 ID 等）。
 *
 * @example
 * // 在中间件中初始化上下文
 * this.contextService.run({
 *   requestId: req.id,
 *   userId: req.user?.id,
 *   time: Date.now(),
 *   metadata: { traceId: req.traceId }
 * }, () => next());
 *
 * // 在服务中访问上下文
 * const context = this.contextService.get();
 * console.log(context.requestId, context.userId);
 *
 * @example
 * // 动态更新元数据
 * this.contextService.mergeContextMetadata({ duration: 100, cacheHit: true });
 */
@Injectable()
export class AlsContextAdapter {
    /** AsyncLocalStorage 实例，用于存储和隔离异步上下文 */
    private asyncLocalStorage = new AsyncLocalStorage<AlsExecutionContext>();

    /**
     * 在指定的请求上下文中执行回调函数。
     *
     * 该方法建立一个异步作用域，在该作用域内所有的 `get()` 调用都会获取相同的上下文副本。
     * 用于在中间件或拦截器中初始化每个请求的上下文。
     *
     * @param context - 请求上下文对象
     * @param callback - 在上下文中执行的回调函数（通常是 next() 或后续处理）
     *
     * @example
     * this.contextService.run(
     *   { requestId: '123', time: Date.now() },
     *   () => next()
     * );
     */
    run(context: AlsExecutionContext, callback: () => void) {
        this.asyncLocalStorage.run(context, callback);
    }

    /**
     * 获取当前请求上下文的深拷贝。
     *
     * 返回的是深拷贝副本，修改拷贝不会影响原上下文。
     * 如果当前没有活跃的上下文（在 run() 作用域外调用），返回 undefined。
     *
     * @returns 请求上下文的深拷贝，或 undefined 如果不存在
     *
     * @example
     * const context = this.contextService.get();
     * if (context) {
     *   console.log(context.requestId); // 访问请求 ID
     * }
     */
    get() {
        return cloneDeep(this.asyncLocalStorage.getStore());
    }

    /**
     * 合并新的元数据到当前请求上下文的 metadata 字段。
     *
     * 使用深合并允许部分更新，支持嵌套对象更新。
     *
     * @param metadata - 要合并的元数据对象
     * @returns 成功合并返回 true，不存在上下文返回 false
     *
     * @example
     * // 添加响应时间和缓存信息
     * this.contextService.mergeContextMetadata({
     *   duration: 45,
     *   cacheHit: true,
     *   dbQueryCount: 3
     * });
     */
    mergeContextMetadata(metadata: Record<string, any>) {
        const context = this.asyncLocalStorage.getStore();
        if (!context) return false;
        context.metadata = merge(context.metadata, metadata);
        return true;
    }
}
