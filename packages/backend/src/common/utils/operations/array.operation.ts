/**
 * 数组集合操作工具 - 高级数组操作（分组、计数、索引等）。
 */

/**
 * 将数组分割成指定大小的块。
 * 常用于分页、批量处理等场景。
 *
 * @template T - 数组元素类型
 * @param items - 待分割的数组
 * @param size - 块的大小（必须 > 0）
 * @returns 分割后的数组块
 *
 * @example
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
    if (size <= 0) return [];

    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }

    return chunks;
}

/**
 * 按指定键去重数组，保留首次出现的元素。
 * 常用于按 id 或其他属性对对象数组去重。
 *
 * @template T - 数组元素类型
 * @template K - 键类型
 * @param items - 待去重的数组
 * @param getKey - 获取去重键的函数
 * @returns 去重后的数组
 *
 * @example
 * uniqueBy([{ id: 1, name: 'Alice' }, { id: 1, name: 'Alice' }], u => u.id)
 * // [{ id: 1, name: 'Alice' }]
 */
export function uniqueBy<T, K extends PropertyKey>(
    items: readonly T[],
    getKey: (item: T) => K
): T[] {
    const seen = new Set<K>();
    const result: T[] = [];

    for (const item of items) {
        const key = getKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
    }

    return result;
}

/**
 * 移除数组中的 null 和 undefined 值，并保证类型安全。
 * 常用于清理可选值。
 *
 * @template T - 数组元素类型
 * @param items - 可能包含 null/undefined 的数组
 * @returns 过滤后的数组
 *
 * @example
 * compact(['a', null, 'b', undefined]) // ['a', 'b']
 */
export function compact<T>(items: ReadonlyArray<T | null | undefined>): T[] {
    return items.filter((item): item is T => item !== null && item !== undefined);
}

/**
 * 按指定键对对象数组进行分组。
 *
 * @param items - 待分组的数组
 * @param getKey - 获取分组键的函数
 * @returns 分组结果的Map<key, items[]>
 *
 * @example
 * const users = [
 *   { id: 1, department: 'dev' },
 *   { id: 2, department: 'dev' },
 *   { id: 3, department: 'hr' },
 * ];
 * const groups = groupBy(users, u => u.department);
 * // groups.get('dev') => [{ id: 1, ... }, { id: 2, ... }]
 * // groups.get('hr') => [{ id: 3, ... }]
 */
export function groupBy<T, K extends PropertyKey>(
    items: readonly T[],
    getKey: (item: T) => K
): Map<K, T[]> {
    const result = new Map<K, T[]>();

    for (const item of items) {
        const key = getKey(item);
        if (!result.has(key)) {
            result.set(key, []);
        }
        result.get(key)?.push(item);
    }

    return result;
}

/**
 * 按指定键对对象数组进行计数（统计每个键出现的次数）。
 *
 * @param items - 待计数的数组
 * @param getKey - 获取计数键的函数
 * @returns 计数结果的Map<key, count>
 *
 * @example
 * const users = [
 *   { name: 'Alice', role: 'admin' },
 *   { name: 'Bob', role: 'user' },
 *   { name: 'Charlie', role: 'user' },
 * ];
 * const counts = countBy(users, u => u.role);
 * // counts.get('admin') => 1
 * // counts.get('user') => 2
 */
export function countBy<T, K extends PropertyKey>(
    items: readonly T[],
    getKey: (item: T) => K
): Map<K, number> {
    const result = new Map<K, number>();

    for (const item of items) {
        const key = getKey(item);
        result.set(key, (result.get(key) ?? 0) + 1);
    }

    return result;
}

/**
 * 根据指定键为数组项建立索引（创建键到项的映射）。
 * 如果有重复的键，后面的项会覆盖前面的。
 *
 * @param items - 待索引的数组
 * @param getKey - 获取索引键的函数
 * @returns 索引结果的Map<key, item>
 *
 * @example
 * const users = [
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' },
 * ];
 * const byId = keyBy(users, u => u.id);
 * // byId.get(1) => { id: 1, name: 'Alice' }
 * // byId.get(2) => { id: 2, name: 'Bob' }
 */
export function keyBy<T, K extends PropertyKey>(
    items: readonly T[],
    getKey: (item: T) => K
): Map<K, T> {
    const result = new Map<K, T>();

    for (const item of items) {
        const key = getKey(item);
        result.set(key, item);
    }

    return result;
}

/**
 * Finds the array element with the minimum value for a given property.
 *
 * ⚠️ **DEPRECATED**: Use `_.minBy()` from lodash instead for consistency.
 * This function will be removed in a future major version.
 *
 * Returns undefined if the array is empty. Useful for finding the cheapest item, shortest string, etc.
 *
 * @template T - Element type of the array
 * @param items - Array to search
 * @param getValue - Function to extract the numerical value to compare
 * @returns Element with minimum value, or undefined if array is empty
 *
 * @example
 * ```typescript
 * const users = [
 *   { name: 'Alice', age: 30 },
 *   { name: 'Bob', age: 25 },
 *   { name: 'Charlie', age: 35 }
 * ];
 * minBy(users, u => u.age)  // { name: 'Bob', age: 25 }
 * ```
 *
 * @example
 * ```typescript
 * // Migration to lodash
 * import { minBy } from 'lodash';
 * const cheapest = minBy(items, item => item.price);
 * ```
 *
 * @deprecated Use `_.minBy()` from lodash instead
 * @see {@link https://lodash.com/docs/#minBy | lodash.minBy}
 */
export function minBy<T>(items: readonly T[], getValue: (item: T) => number): T | undefined {
    if (items.length === 0) return undefined;

    let minItem = items[0];
    let minValue = getValue(minItem);

    for (let i = 1; i < items.length; i++) {
        const value = getValue(items[i]);
        if (value < minValue) {
            minValue = value;
            minItem = items[i];
        }
    }

    return minItem;
}

/**
 * Finds the array element with the maximum value for a given property.
 *
 * ⚠️ **DEPRECATED**: Use `_.maxBy()` from lodash instead for consistency.
 * This function will be removed in a future major version.
 *
 * Returns undefined if the array is empty. Useful for finding the highest salary, longest string, etc.
 *
 * @template T - Element type of the array
 * @param items - Array to search
 * @param getValue - Function to extract the numerical value to compare
 * @returns Element with maximum value, or undefined if array is empty
 *
 * @example
 * ```typescript
 * const users = [
 *   { name: 'Alice', salary: 50000 },
 *   { name: 'Bob', salary: 60000 },
 *   { name: 'Charlie', salary: 55000 }
 * ];
 * maxBy(users, u => u.salary)  // { name: 'Bob', salary: 60000 }
 * ```
 *
 * @example
 * ```typescript
 * // Migration to lodash
 * import { maxBy } from 'lodash';
 * const richest = maxBy(items, item => item.net_worth);
 * ```
 *
 * @deprecated Use `_.maxBy()` from lodash instead
 * @see {@link https://lodash.com/docs/#maxBy | lodash.maxBy}
 */
export function maxBy<T>(items: readonly T[], getValue: (item: T) => number): T | undefined {
    if (items.length === 0) return undefined;

    let maxItem = items[0];
    let maxValue = getValue(maxItem);

    for (let i = 1; i < items.length; i++) {
        const value = getValue(items[i]);
        if (value > maxValue) {
            maxValue = value;
            maxItem = items[i];
        }
    }

    return maxItem;
}

/**
 * 对数组求和。
 *
 * @param items - 待求和的数组
 * @param getValue - 获取数值的函数（可选，默认直接使用项的值）
 * @returns 数组元素的总和
 *
 * @example
 * sum([1, 2, 3, 4, 5]) // 15
 * sum([
 *   { name: 'Alice', score: 90 },
 *   { name: 'Bob', score: 85 },
 * ], item => item.score) // 175
 */
export function sum<T>(items: readonly T[], getValue?: (item: T) => number): number {
    return items.reduce((total, item) => {
        const value = getValue ? getValue(item) : (item as any);
        return total + (typeof value === 'number' ? value : 0);
    }, 0);
}

/**
 * 计算数组数值的平均值。
 * 如果数组为空，返回 0。
 *
 * @param items - 待计算的数组
 * @param getValue - 获取数值的函数（可选，默认直接使用项的值）
 * @returns 平均值
 *
 * @example
 * average([1, 2, 3, 4, 5]) // 3
 * average([90, 80, 85]) // 85
 */
export function average<T>(items: readonly T[], getValue?: (item: T) => number): number {
    if (items.length === 0) return 0;
    return sum(items, getValue) / items.length;
}

/**
 * 将数组按大小分页。
 * 与 chunk 类似，但返回 {items, page, pageSize, total}。
 *
 * @param items - 全部项数组
 * @param pageNumber - 页码（从1开始），默认1
 * @param pageSize - 每页大小，默认10
 * @returns 分页结果对象
 *
 * @example
 * const result = paginate([1, 2, 3, 4, 5], 2, 2);
 * // { items: [3, 4], page: 2, pageSize: 2, total: 5, pageCount: 3 }
 */
export function paginate<T>(
    items: readonly T[],
    pageNumber: number = 1,
    pageSize: number = 10
): {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
} {
    const total = items.length;
    const pageCount = Math.ceil(total / pageSize);
    const page = Math.max(1, Math.min(pageNumber, pageCount));
    const startIndex = (page - 1) * pageSize;

    return {
        items: items.slice(startIndex, startIndex + pageSize) as T[],
        page,
        pageSize,
        total,
        pageCount,
    };
}

/**
 * Flattens a 2D array into a 1D array.
 *
 * ⚠️ **DEPRECATED**: Use `_.flatten()` from lodash for consistency.
 * This function will be removed in a future major version.
 *
 * Only flattens one level (does not recursively flatten nested arrays).
 * For deeper flattening, use `_.flatten()` or `_.flattenDeep()`.
 *
 * @template T - Element type of the inner arrays
 * @param items - 2D array to flatten
 * @returns Flattened 1D array
 *
 * @example
 * ```typescript
 * flatten([[1, 2], [3, 4], [5]])
 * // Returns: [1, 2, 3, 4, 5]
 * ```
 *
 * @example
 * ```typescript
 * // Migration to lodash
 * import { flatten } from 'lodash';
 * const flat = flatten(nestedArray);
 * ```
 *
 * @deprecated Use `_.flatten()` from lodash instead
 * @see {@link https://lodash.com/docs/#flatten | lodash.flatten}
 * @see {@link https://lodash.com/docs/#flattenDeep | lodash.flattenDeep} - For deep flattening
 */
export function flatten<T>(items: readonly (readonly T[])[]): T[] {
    const result: T[] = [];
    for (const item of items) {
        result.push(...item);
    }
    return result;
}

/**
 * 笛卡尔积：组合两个数组的所有元素对。
 *
 * @param list1 - 第一个数组
 * @param list2 - 第二个数组
 * @returns 包含所有组合对的数组
 *
 * @example
 * cartesianProduct([1, 2], ['a', 'b'])
 * // [[1, 'a'], [1, 'b'], [2, 'a'], [2, 'b']]
 */
export function cartesianProduct<T, U>(list1: readonly T[], list2: readonly U[]): Array<[T, U]> {
    const result: Array<[T, U]> = [];

    for (const item1 of list1) {
        for (const item2 of list2) {
            result.push([item1, item2]);
        }
    }

    return result;
}
