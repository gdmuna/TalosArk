/**
 * 日期工具 - 时间运算和操作。
 * 基于原生Date对象，不依赖外部库。
 */

/**
 * 获取指定日期的起始时刻（00:00:00.000）。
 *
 * @param date - 输入日期，默认为今天
 * @returns 该日期的0时0分0秒
 *
 * @example
 * getStartOfDay(new Date('2025-03-20 14:30:45'))
 * // 返回 2025-03-20 00:00:00
 */
export function getStartOfDay(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * 获取指定日期的结束时刻（23:59:59.999）。
 *
 * @param date - 输入日期，默认为今天
 * @returns 该日期的23时59分59秒
 *
 * @example
 * getEndOfDay(new Date('2025-03-20 14:30:45'))
 * // 返回 2025-03-20 23:59:59.999
 */
export function getEndOfDay(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}

/**
 * 获取月份的起始日期（该月第一天的0时0分）。
 *
 * @param date - 输入日期，默认为今月
 * @returns 该月第一天的00:00:00
 *
 * @example
 * getStartOfMonth(new Date('2025-03-20'))
 * // 返回 2025-03-01 00:00:00
 */
export function getStartOfMonth(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * 获取月份的结束日期（该月最后一天的23:59:59）。
 *
 * @param date - 输入日期，默认为今月
 * @returns 该月最后一天的23:59:59.999
 *
 * @example
 * getEndOfMonth(new Date('2025-03-20'))
 * // 返回 2025-03-31 23:59:59.999
 */
export function getEndOfMonth(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1);
    result.setDate(0);
    result.setHours(23, 59, 59, 999);
    return result;
}

/**
 * 为日期增加指定的天数（支持负数表示减少）。
 *
 * @param date - 起始日期
 * @param days - 增加的天数（负数表示减少）
 * @returns 新的日期对象
 *
 * @example
 * addDays(new Date('2025-03-20'), 5) // 2025-03-25
 * addDays(new Date('2025-03-20'), -10) // 2025-03-10
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * 为日期增加指定的小时数（支持负数）。
 *
 * @param date - 起始日期
 * @param hours - 增加的小时数（负数表示减少）
 * @returns 新的日期对象
 */
export function addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * 为日期增加指定的分钟数（支持负数）。
 *
 * @param date - 起始日期
 * @param minutes - 增加的分钟数（负数表示减少）
 * @returns 新的日期对象
 */
export function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * 计算两个日期之间相差的天数（向下取整）。
 * 如果开始日期晚于结束日期，返回负数。
 *
 * @param startDate - 起始日期
 * @param endDate - 结束日期，默认为今天
 * @returns 相差的天数
 *
 * @example
 * diffDays(new Date('2025-03-01'), new Date('2025-03-11')) // 10
 * diffDays(new Date('2025-03-11'), new Date('2025-03-01')) // -10
 */
export function diffDays(startDate: Date, endDate: Date = new Date()): number {
    const start = getStartOfDay(startDate);
    const end = getStartOfDay(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * 计算两个日期之间相差的小时数。
 *
 * @param startDate - 起始日期
 * @param endDate - 结束日期，默认为现在
 * @returns 相差的小时数（向下取整）
 */
export function diffHours(startDate: Date, endDate: Date = new Date()): number {
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.floor(diffMs / (60 * 60 * 1000));
}

/**
 * 判断是否在指定日期范围内（包含边界）。
 *
 * @param date - 待检验的日期
 * @param startDate - 范围起始日期
 * @param endDate - 范围结束日期
 * @returns 如果在范围内返回 true
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
    return date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();
}
