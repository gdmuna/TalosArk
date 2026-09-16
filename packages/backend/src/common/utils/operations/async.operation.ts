/**
 * 异步操作工具 - 延时、重试、超时等常见异步模式。
 */

/**
 * 将 Promise 执行结果包装为 [err, res]，统一 async/await 错误处理分支。
 * 返回约定：发生错误时为 [Error, null]，成功时为 [null, T]。
 *
 * @example
 * const [err, data] = await to(fetchData());
 * if (err) {
 *   console.error(err.message);
 *   return;
 * }
 * console.log(data); // type is T, not T | null
 */
export async function to<T>(
    promiseOrFn: Promise<T> | (() => Promise<T>)
): Promise<[unknown, null] | [null, T]> {
    try {
        const result =
            typeof promiseOrFn === 'function'
                ? await (promiseOrFn as () => Promise<T>)()
                : await promiseOrFn;
        return [null, result];
    } catch (err) {
        return [err, null];
    }
}

/**
 * 延迟执行指定毫秒数（Promise封装的sleep）。
 * 常用于流控、防止快速重复请求等场景。
 *
 * @param ms - 延迟毫秒数
 * @returns 延迟后resolved的Promise
 *
 * @example
 * await sleep(1000); // 等待1秒
 * for (let i = 0; i < 10; i++) {
 *   await sleep(100); // 每次循环间隔100ms
 * }
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * 为Promise设置超时限制。
 * 如果Promise在指定时间内未resolve，将抛出TimeoutError。
 *
 * @param promise - 待执行的Promise
 * @param ms - 超时毫秒数
 * @param message - 超时错误信息
 * @returns 原Promise或超时error
 *
 * @example
 * const result = await timeout(fetchData(), 5000, 'API request timeout');
 */
export async function timeout<T>(
    promise: Promise<T>,
    ms: number,
    message = `Operation timeout after ${ms}ms`
): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
            () => {
                reject(new Error(message));
            },
            Math.max(0, ms)
        );
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}

/**
 * 重试失败的异步操作。
 * 在遇到错误时会按指定策略重新尝试，直到成功或重试次数用尽。
 *
 * @param fn - 待重试的异步函数
 * @param options - 重试配置选项
 * @returns 操作结果
 *
 * @example
 * const data = await retry(
 *   () => fetchAPI(),
 *   { maxAttempts: 3, delayMs: 1000 }
 * );
 *
 * // 使用指数退避
 * const data = await retry(
 *   () => fetchAPI(),
 *   { maxAttempts: 5, delayMs: 100, backoffMultiplier: 2 }
 * );
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: {
        /** 最大重试次数（包含首次），默认3 */
        maxAttempts?: number;
        /** 重试延迟毫秒数，默认1000 */
        delayMs?: number;
        /** 退避倍数（用于指数退避），默认1（无退避） */
        backoffMultiplier?: number;
        /** 是否打印调试信息 */
        verbose?: boolean;
    } = {}
): Promise<T> {
    const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 1, verbose = false } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            if (verbose && attempt > 1) {
                // eslint-disable-next-line no-console
                console.debug(`[retry] Attempt ${attempt}/${maxAttempts} for operation`);
            }
            return await fn();
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            if (attempt === maxAttempts) {
                // 最后一次失败，抛出错误
                throw lastError;
            }

            // 计算下次重试的延迟时间
            const delayMs_ = delayMs * Math.pow(backoffMultiplier, attempt - 1);

            if (verbose) {
                // eslint-disable-next-line no-console
                console.debug(`[retry] Failed: ${lastError.message}, retrying in ${delayMs_}ms...`);
            }

            await sleep(delayMs_);
        }
    }

    // 不应该到达此处
    throw lastError || new Error('Unknown retry error');
}

/**
 * 并发控制：限制并发的Promise执行数量。
 * 常用于API请求限流、数据库连接池等场景。
 *
 * @param tasks - 任务函数数组，每个返回Promise
 * @param concurrency - 最大并发数，默认为1
 * @returns 所有任务的结果数组
 *
 * @example
 * const urls = ['url1', 'url2', 'url3', ...];
 * const results = await pLimit(
 *   urls.map(url => () => fetch(url)),
 *   3 // 最多同时fetch 3个
 * );
 */
export async function pLimit<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number = 1
): Promise<T[]> {
    if (concurrency <= 0) {
        throw new Error('Concurrency must be > 0');
    }

    const results: T[] = [];
    let activeCount = 0;
    let taskIndex = 0;

    return new Promise((resolve, reject) => {
        const executeNextTask = async () => {
            if (taskIndex >= tasks.length) {
                // 所有任务已提交
                if (activeCount === 0) {
                    // 所有任务都完成了
                    resolve(results);
                }
                return;
            }

            const currentIndex = taskIndex++;
            activeCount++;

            try {
                const result = await tasks[currentIndex]();
                results[currentIndex] = result;
            } catch (err) {
                reject(err);
            } finally {
                activeCount--;
                executeNextTask();
            }
        };

        // 启动初始并发任务
        for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
            executeNextTask();
        }
    });
}

/**
 * 竞速 - 返回第一个成功或全部失败。
 * 与 Promise.race 不同，它会等待至少一个成功或全部失败。
 *
 * @param promises - Promise数组
 * @returns 第一个成功的结果
 *
 * @example
 * const result = await firstSuccess([
 *   fetch('api1'),
 *   fetch('api2'),
 *   fetch('api3')
 * ]); // 返回第一个成功的响应
 */
export async function firstSuccess<T>(promises: Promise<T>[]): Promise<T> {
    if (promises.length === 0) {
        throw new Error('firstSuccess requires at least one promise');
    }

    let lastError: Error | null = null;

    for (const promise of promises) {
        try {
            return await promise;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
        }
    }

    throw lastError || new Error('No promise succeeded');
}
