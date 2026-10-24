/**
 * 函数控制工具 - 防抖、节流、缓存和其他高阶函数增强。
 * 用于优化函数执行频率、性能和行为。
 */

/**
 * 成功结果类型 - 包含执行成功的数据。
 * 以元组形式表示，第一项为 true，第二项为数据。
 */
export type Ok<T> = [data: T, err: undefined];

/**
 * 失败结果类型 - 包含执行失败的错误信息。
 * 以元组形式表示，第一项为 false，第二项为错误信息。
 */
export type Fail<E> = [data: undefined, err: E];

/**
 * 结果类型 - 表示函数执行成功或失败的结果。
 * 成功时包含数据，失败时包含错误信息。
 */
export type Result<T, E> = Ok<T> | Fail<E>;

/**
 *  创建一个成功结果。
 * @param data 成功的数据
 * @returns 一个 Ok 类型的结果，表示成功并包含数据
 */
export function ok<T>(data: T): Ok<T> {
    return [data, undefined];
}

/**
 *  创建一个失败结果。
 * @param err 失败的错误信息
 * @returns 一个 Fail 类型的结果，表示失败并包含错误信息
 */
export function fail<E>(err: E): Fail<E> {
    return [undefined, err];
}

/**
 * 防抖 (Debounce) - 延迟执行，最后一次调用后等待指定时间才执行。
 * 常用于搜索输入、窗口调整等频繁触发的事件。
 *
 * @param fn - 待防抖的函数
 * @param delay - 延迟毫秒数
 * @param options - 配置选项
 * @param options.leading - 是否在延迟前立即执行（默认false）
 * @param options.trailing - 是否在延迟后执行（默认true）
 * @param options.maxWait - 最大等待时间（毫秒），超过此时间必定执行
 * @returns 防抖后的函数和取消方法
 *
 * @example
 * const { debounced, cancel } = debounce(
 *   () => console.log('search'),
 *   300
 * );
 * // 快速调用多次，但只在最后一次后300ms执行一次
 * debounced(); debounced(); debounced();
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
    options: {
        leading?: boolean;
        trailing?: boolean;
        maxWait?: number;
    } = {}
): {
    (...args: Parameters<T>): void;
    cancel: () => void;
} {
    const { leading = false, trailing = true, maxWait } = options;
    let timerId: NodeJS.Timeout | null = null;
    let maxTimerId: NodeJS.Timeout | null = null;
    let lastInvokeTime: number = 0;

    const run = (...args: Parameters<T>) => {
        lastInvokeTime = Date.now();
        fn(...args);
    };

    const debounced = (...args: Parameters<T>) => {
        const now = Date.now();

        // 清除旧的延迟定时器
        if (timerId) clearTimeout(timerId);
        if (maxTimerId) clearTimeout(maxTimerId);

        // 首次调用且设置了 leading
        if (leading && lastInvokeTime === 0) {
            run(...args);
        }

        // 设置延迟定时器
        if (trailing) {
            timerId = setTimeout(() => {
                run(...args);
                timerId = null;
            }, delay);
        }

        // 设置最大等待定时器
        if (maxWait && lastInvokeTime > 0) {
            const timeSinceLastInvoke = now - lastInvokeTime;
            if (timeSinceLastInvoke >= maxWait) {
                run(...args);
            } else {
                maxTimerId = setTimeout(() => {
                    run(...args);
                    maxTimerId = null;
                }, maxWait - timeSinceLastInvoke);
            }
        }
    };

    debounced.cancel = () => {
        if (timerId) clearTimeout(timerId);
        if (maxTimerId) clearTimeout(maxTimerId);
        timerId = null;
        maxTimerId = null;
    };

    return debounced;
}

/**
 * 节流 (Throttle) - 按固定时间间隔执行，一段时间内最多执行一次。
 * 常用于滚动事件、鼠标移动等连续事件。
 *
 * @param fn - 待节流的函数
 * @param interval - 执行间隔（毫秒）
 * @param options - 配置选项
 * @param options.leading - 首次调用是否立即执行（默认true）
 * @param options.trailing - 是否执行最后一次调用（默认true）
 * @returns 节流后的函数和取消方法
 *
 * @example
 * const { throttled } = throttle(
 *   () => console.log('scroll'),
 *   1000
 * );
 * // 快速调用多次，每1000ms最多执行一次
 * throttled(); throttled(); throttled();
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    interval: number,
    options: {
        leading?: boolean;
        trailing?: boolean;
    } = {}
): {
    (...args: Parameters<T>): void;
    cancel: () => void;
} {
    const { leading = true, trailing = true } = options;
    let timerId: NodeJS.Timeout | null = null;
    let lastInvokeTime: number = 0;
    let lastArgs: Parameters<T> | null = null;

    const run = (...args: Parameters<T>) => {
        lastInvokeTime = Date.now();
        fn(...args);
        lastArgs = null;
    };

    const throttled = (...args: Parameters<T>) => {
        const now = Date.now();
        lastArgs = args;

        // 首次调用且 leading=true
        if (leading && lastInvokeTime === 0) {
            run(...args);
            return;
        }

        const timeSinceLastInvoke = now - lastInvokeTime;
        const shouldInvoke = timeSinceLastInvoke >= interval;

        if (shouldInvoke) {
            run(...args);
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
        } else if (trailing && !timerId) {
            const remainingTime = interval - timeSinceLastInvoke;
            timerId = setTimeout(() => {
                if (lastArgs) {
                    run(...lastArgs);
                }
                timerId = null;
            }, remainingTime);
        }
    };

    throttled.cancel = () => {
        if (timerId) clearTimeout(timerId);
        timerId = null;
        lastInvokeTime = 0;
    };

    return throttled;
}

/**
 * 只执行一次 (Once) - 无论调用多少次，函数只执行一次。
 * 常用于初始化操作、事件监听器只执行一次等。
 *
 * @param fn - 待包装的函数
 * @returns 包装后的函数，只会执行一次
 *
 * @example
 * const initialize = once(() => console.log('initialized'));
 * initialize(); // 打印 'initialized'
 * initialize(); // 不执行
 * initialize(); // 不执行
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
    let called = false;
    let result: any;

    return ((...args: Parameters<T>) => {
        if (!called) {
            called = true;
            result = fn(...args);
        }
        return result;
    }) as T;
}

/**
 * 记忆化 (Memoize) - 缓存函数执行结果，相同参数返回缓存结果。
 * 常用于纯函数计算结果缓存以提高性能。
 *
 * @param fn - 纯函数（相同输入应产生相同输出）
 * @param resolver - 自定义缓存键生成器（默认使用第一个参数作为键）
 * @returns 带缓存的函数
 *
 * @example
 * const fibonacci = memoize((n: number): number => {
 *   if (n <= 1) return n;
 *   return fibonacci(n - 1) + fibonacci(n - 2);
 * });
 * console.log(fibonacci(40)); // 快速计算（缓存结果）
 */
export function memoize<T extends (...args: any[]) => any>(
    fn: T,
    resolver?: (...args: Parameters<T>) => string
): T {
    const cache = new Map<string, any>();

    return ((...args: Parameters<T>) => {
        const key = resolver ? resolver(...args) : String(args[0]);

        if (cache.has(key)) {
            return cache.get(key);
        }

        const result = fn(...args);
        cache.set(key, result);
        return result;
    }) as T;
}

/**
 * 限流 (Limit) - 限制函数同时执行次数，返回Promise。
 * 常用于API调用、并发任务控制等。
 *
 * @param fn - 异步函数
 * @param limit - 同时执行的最大数量
 * @returns 限流后的异步函数
 *
 * @example
 * const limitedFetch = limit(fetch, 3);
 * // 同时最多3个请求执行
 * Promise.all([
 *   limitedFetch('/api/1'),
 *   limitedFetch('/api/2'),
 *   limitedFetch('/api/3'),
 *   limitedFetch('/api/4'),
 * ]);
 */
export function limit<T extends (...args: any[]) => Promise<any>>(fn: T, limit: number): T {
    const queue: Array<() => void> = [];
    let running = 0;

    const execute = async (...args: Parameters<T>) => {
        while (running >= limit) {
            await new Promise<void>((resolve) => queue.push(resolve));
        }

        running++;
        try {
            return await fn(...args);
        } finally {
            running--;
            const next = queue.shift();
            if (next) next();
        }
    };

    return execute as T;
}

/**
 * 组合函数 (Compose) - 从右往左组装函数，后一个函数的输出是前一个的输入。
 * 函数式编程中的基础组合工具。
 *
 * @param fns - 待组装的函数列表
 * @returns 组合后的函数
 *
 * @example
 * const addOne = (n: number) => n + 1;
 * const double = (n: number) => n * 2;
 * const composed = compose(double, addOne);
 * composed(5); // double(addOne(5)) => 12
 */
export function compose<T = any>(...fns: Array<(arg: any) => any>): (arg: T) => any {
    return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg);
}
