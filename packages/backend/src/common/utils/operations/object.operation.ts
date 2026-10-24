/**
 * 对象操作工具 - 支持点路径访问深层属性。
 */

/**
 * 从对象中挑选指定字段。
 *
 * @param obj - 源对象
 * @param keys - 要挑选的键数组
 * @returns 包含指定字段的新对象
 *
 * @example
 * pick({ name: 'John', age: 30, email: 'john@example.com' }, ['name', 'age'])
 * // { name: 'John', age: 30 }
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: readonly K[]
): Pick<T, K> {
    const result = {} as Pick<T, K>;

    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }

    return result;
}

/**
 * 从对象中排除指定字段。
 *
 * @param obj - 源对象
 * @param keys - 要排除的键数组
 * @returns 不包含指定字段的新对象
 *
 * @example
 * omit({ name: 'John', age: 30, password: 'secret' }, ['password'])
 * // { name: 'John', age: 30 }
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: readonly K[]
): Omit<T, K> {
    const keySet = new Set<keyof T>(keys);
    const result: Partial<T> = {};

    for (const key of Object.keys(obj) as Array<keyof T>) {
        if (!keySet.has(key)) {
            result[key] = obj[key];
        }
    }

    return result as Omit<T, K>;
}

/**
 * 通过点路径获取对象深层属性。
 * 路径不存在时返回默认值（不抛异常）。
 *
 * @param obj - 源对象
 * @param path - 点路径字符串，如 'user.profile.name'
 * @param defaultValue - 默认值
 * @returns 属性值或默认值
 *
 * @example
 * get({ user: { profile: { name: 'Alice' } } }, 'user.profile.name') // 'Alice'
 * get({ user: {} }, 'user.missing', 0) // 0
 */
export function get<T = any>(
    obj: Record<string, any> | null | undefined,
    path: string,
    defaultValue?: T
): T | undefined {
    if (!obj || typeof obj !== 'object') return defaultValue;

    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return defaultValue;
        }
        current = current[key];
    }

    return current !== null && current !== undefined ? current : defaultValue;
}

/**
 * 通过点路径设置对象深层属性。
 * 会自动创建缺少的中间对象层级。
 *
 * @param obj - 目标对象
 * @param path - 点路径字符串
 * @param value - 要设置的值
 * @returns 修改后的对象
 *
 * @example
 * const obj = {};
 * set(obj, 'user.profile.name', 'Alice');
 * // obj: { user: { profile: { name: 'Alice' } } }
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function set<T extends Record<string, any>>(obj: T, path: string, value: any): T {
    const keys = path.split('.');

    if (keys.some((k) => UNSAFE_KEYS.has(k))) return obj;

    let current: any = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!Object.hasOwn(current, key) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;

    return obj;
}

/**
 * 检查对象中是否存在指定的点路径属性。
 *
 * @param obj - 源对象
 * @param path - 点路径字符串
 * @returns 路径是否存在
 *
 * @example
 * has({ user: { profile: { name: 'Alice' } } }, 'user.profile.name') // true
 * has({ user: {} }, 'user.missing') // false
 */
export function has(obj: Record<string, any> | null | undefined, path: string): boolean {
    if (!obj || typeof obj !== 'object') return false;

    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
        if (
            current === null ||
            current === undefined ||
            typeof current !== 'object' ||
            !(key in current)
        ) {
            return false;
        }
        current = current[key];
    }

    return true;
}

/**
 * 删除对象中指定的点路径属性。
 *
 * @param obj - 目标对象
 * @param path - 点路径字符串
 * @returns 修改后的对象
 *
 * @example
 * const obj = { user: { profile: { name: 'Alice', age: 30 } } };
 * unset(obj, 'user.profile.age');
 * // obj: { user: { profile: { name: 'Alice' } } }
 */
export function unset<T extends Record<string, any>>(obj: T, path: string): T {
    const keys = path.split('.');

    if (keys.length === 0) return obj;

    if (keys.some((k) => UNSAFE_KEYS.has(k))) return obj;

    // 找到倒数第二个节点
    let current: any = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!Object.hasOwn(current, key) || typeof current[key] !== 'object') {
            // 路径不存在，直接返回
            return obj;
        }
        current = current[key];
    }

    // 删除最后一个键
    const lastKey = keys[keys.length - 1];
    delete current[lastKey];

    return obj;
}

/**
 * 转换对象的所有键。
 * 递归处理嵌套对象和数组。
 *
 * @param obj - 源对象
 * @param transform - 键转换函数
 * @returns 转换后的新对象
 *
 * @example
 * transformKeys({ user_name: 'Alice' }, key => key.replace(/_/g, ''))
 * // { username: 'Alice' }
 */
export function transformKeys<T extends Record<string, any>>(
    obj: T,
    transform: (key: string) => string
): Record<string, any> {
    if (Array.isArray(obj)) {
        return obj.map((item) =>
            typeof item === 'object' && item !== null ? transformKeys(item, transform) : item
        ) as any;
    }

    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        const newKey = transform(key);
        result[newKey] =
            typeof value === 'object' && value !== null ? transformKeys(value, transform) : value;
    }

    return result;
}

/**
 * 将驼峰命名的对象键转换为蛇形命名。
 * 适用于与后端 API 的数据转换。
 *
 * @param obj - 源对象
 * @returns 转换后的对象
 *
 * @example
 * toSnakeCaseKeys({ userId: 123, userName: 'Alice' })
 * // { user_id: 123, user_name: 'Alice' }
 */
export function toSnakeCaseKeys<T extends Record<string, any>>(obj: T): Record<string, any> {
    return transformKeys(obj, (key) => key.replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase());
}

/**
 * 将蛇形命名的对象键转换为驼峰命名。
 * 适用于将后端数据转换为前端风格。
 *
 * @param obj - 源对象
 * @returns 转换后的对象
 *
 * @example
 * toCamelCaseKeys({ user_id: 123, user_name: 'Alice' })
 * // { userId: 123, userName: 'Alice' }
 */
export function toCamelCaseKeys<T extends Record<string, any>>(obj: T): Record<string, any> {
    return transformKeys(obj, (key) =>
        key
            .split('_')
            .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
            .join('')
    );
}

/**
 * 检查值是否为纯对象（POJO - 纯 JavaScript 对象）。
 * 数组、日期、正则等特殊对象类型返回 false。
 *
 * @param value - 待检查的值
 * @returns 是否为纯对象
 *
 * @example
 * isPlainObject({})              // true
 * isPlainObject({ a: 1, b: 2 }) // true
 * isPlainObject([])              // false (数组)
 * isPlainObject(new Date())      // false
 * isPlainObject(null)            // false
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
}
