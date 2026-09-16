/**
 * JSON 和数据序列化工具 - 提供安全的JSON操作和深度复制。
 */

/**
 * 安全地解析JSON字符串，失败时返回默认值而不抛异常。
 * 常用于处理可能无效的JSON数据。
 *
 * @param json - JSON字符串
 * @param fallback - 解析失败时的默认值
 * @returns 解析结果或fallback值
 *
 * @example
 * safeJsonParse('{"a":1}', null) // { a: 1 }
 * safeJsonParse('invalid json', null) // null
 * safeJsonParse('{"a":1}', {}) // { a: 1 } 或 {}
 */
export function safeJsonParse<T = any>(json: string, fallback: T): T | any {
    try {
        return JSON.parse(json);
    } catch {
        return fallback;
    }
}

/**
 * 安全地将对象转换为JSON字符串，失败时返回默认值。
 * 自动处理 undefined、函数等不可序列化的值。
 *
 * @param value - 待序列化的值
 * @param fallback - 序列化失败时的默认值
 * @param space - 缩进空格数（用于格式化输出），默认为0
 * @returns JSON字符串或fallback值
 *
 * @example
 * safeJsonStringify({ a: 1, b: 2 }, '{}') // '{"a":1,"b":2}'
 * safeJsonStringify({ fn: () => {} }, '{}', 2) // '{}' 或 格式化版本
 */
export function safeJsonStringify<T = string>(value: any, fallback: T, space?: number): string | T {
    try {
        return JSON.stringify(value, null, space);
    } catch {
        return fallback;
    }
}

/**
 * 深度克隆对象（使用JSON序列化反序列化方法）。
 * 注意：会丢失函数、undefined、Symbol、Date等特殊类型。
 * 对于包含这些类型的对象，请使用结构化克隆或第三方库。
 *
 * @param obj - 待克隆的对象
 * @returns 克隆后的对象（未修改原对象）
 *
 * @example
 * const original = { a: 1, b: { c: 2 } };
 * const cloned = deepClone(original);
 * cloned.b.c = 99;
 * console.log(original.b.c); // 仍为 2
 */
export function deepClone<T>(obj: T): T {
    try {
        return JSON.parse(JSON.stringify(obj)) as T;
    } catch {
        // 如果序列化失败，返回原值（可能包含不可克隆的内容）
        return obj;
    }
}

/**
 * 深度比较两个值是否相等（基于序列化结果）。
 * 注意：函数、undefined、Symbol等不会被比较。
 * 顺序敏感：{a:1,b:2} !== {b:2,a:1}（因为JSON序列化顺序不同）。
 *
 * @param a - 第一个值
 * @param b - 第二个值
 * @returns 两个值在JSON序列化后是否相同
 *
 * @example
 * deepEqual({ a: 1 }, { a: 1 }) // true
 * deepEqual({ a: 1 }, { a: 2 }) // false
 * deepEqual([1, 2], [1, 2]) // true
 */
export function deepEqual(a: any, b: any): boolean {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        // 如果序列化失败，使用简单的引用比较
        return a === b;
    }
}

/**
 * 判断字符串是否为有效的JSON格式。
 * 不会抛异常，仅进行检查。
 *
 * @param value - 待检验的字符串
 * @returns 是否为有效JSON
 *
 * @example
 * isValidJson('{"a":1}') // true
 * isValidJson('invalid') // false
 * isValidJson('null') // true
 */
export function isValidJson(value: string): boolean {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}
