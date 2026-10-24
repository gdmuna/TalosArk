/**
 * 数字工具函数 - 数字验证、转换和范围操作。
 *
 * 所有函数都可安全处理无效输入，返回合理默认值。
 */

/**
 * 将数字限制在指定范围 [min, max] 内。
 * 常用于不透明度（0-1）、百分比（0-100）等值的限制。
 *
 * @param value - 数字
 * @param min - 最小值
 * @param max - 最大值
 * @returns 限制后的数字
 *
 * @example
 * clamp(50, 0, 100)   // 50
 * clamp(-10, 0, 100)  // 0
 * clamp(150, 0, 100)  // 100
 */
export function clamp(value: number, min: number, max: number): number {
    if (min > max) return value;
    return Math.min(Math.max(value, min), max);
}

/**
 * 检查数字是否在指定范围 [min, max] 内（含边界）。
 *
 * @param value - 数字
 * @param min - 最小值
 * @param max - 最大值
 * @returns 是否在范围内
 *
 * @example
 * inRange(50, 0, 100)   // true
 * inRange(-1, 0, 100)   // false
 */
export function inRange(value: number, min: number, max: number): boolean {
    if (min > max) return false;
    return value >= min && value <= max;
}

/**
 * 安全地将值转换为整数。
 * 会截断向零，不是四舍五入。
 *
 * @param value - 待转换的值
 * @param fallback - 转换失败时的默认值，默认 0
 * @returns 整数或默认值
 *
 * @example
 * toSafeInt('42')      // 42
 * toSafeInt('42.9')    // 42 (截断)
 * toSafeInt('invalid') // 0
 */
export function toSafeInt(value: unknown, fallback = 0): number {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.trunc(num);
}

/**
 * 生成指定范围 [min, max] 内的随机整数（含边界）。
 *
 * @param min - 范围的最小值，默认 -Number.MAX_SAFE_INTEGER
 * @param max - 范围的最大值，默认 Number.MAX_SAFE_INTEGER
 * @returns 范围内的随机整数。若 min > max 则返回 min
 *
 * @example
 * generateRandomInt()           // [-9007199254740991, 9007199254740991] 之间的随机整数
 * generateRandomInt(1, 10)      // [1, 10] 之间的随机整数
 * generateRandomInt(0, 100)     // [0, 100] 之间的随机整数
 * generateRandomInt(50, 20)     // 20（min > max，返回 min）
 */
export function generateRandomInt(
    min: number = -Number.MAX_SAFE_INTEGER,
    max: number = Number.MAX_SAFE_INTEGER
) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        min = -Number.MAX_SAFE_INTEGER;
        max = Number.MAX_SAFE_INTEGER;
    }
    if (min > max) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
