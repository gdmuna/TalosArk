/**
 * 字符串工具函数 - 转换、格式化和校验。
 * 所有函数都可安全处理边界情况（空字符串、空白符等）。
 */

/**
 * 检查字符串是否为空（null、undefined或空白符）。
 * 常用于区分 "没有值" 和 "空值"。
 *
 * @param value - 待检查的字符串
 * @returns 是否为空
 *
 * @example
 * isBlank(null)        // true
 * isBlank('   ')       // true
 * isBlank('hello')     // false
 */
export function isBlank(value: string | null | undefined): boolean {
    return value === null || value === undefined || value.trim().length === 0;
}

/**
 * 将字符串的第一个字符大写。
 * 空字符串保持不变，其他字符不变。
 *
 * @param value - 字符串
 * @returns 第一个字符为大写的字符串
 *
 * @example
 * capitalize('hello')  // 'Hello'
 * capitalize('HELLO')  // 'HELLO'
 */
export function capitalize(value: string): string {
    if (value.length === 0) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * 转换为 kebab-case（小写-分隔）。
 * 处理 camelCase、snake_case、空格、特殊字符等。
 *
 * @param value - 待转换的字符串
 * @returns kebab-case 字符串
 *
 * @example
 * toKebabCase('helloWorld')  // 'hello-world'
 * toKebabCase('HELLO')       // 'hello'
 */
export function toKebabCase(value: string): string {
    return value
        .trim()
        .replace(/([a-z\d])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-zA-Z\d-]/g, '')
        .toLowerCase();
}

/**
 * 转换为 camelCase。
 * 处理 kebab-case、snake_case、空格、PascalCase 等。
 *
 * @param value - 待转换的字符串
 * @returns camelCase 字符串
 *
 * @example
 * toCamelCase('hello-world')  // 'helloWorld'
 * toCamelCase('HelloWorld')   // 'helloWorld'
 */
export function toCamelCase(value: string): string {
    const normalized = value
        .trim()
        .replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();

    return normalized.replace(/\s+([a-z\d])/g, (_, c: string) => c.toUpperCase());
}

/**
 *  转换为 snake_case（小写_分隔）。
 *  处理 camelCase、kebab-case、空格、特殊字符等。
 * @param value - 待转换的字符串
 * @returns snake_case 字符串
 *
 * @example
 * toSnakeCase('helloWorld')  // 'hello_world'
 * toSnakeCase('HELLO')      // 'hello'
 * toSnakeCase('hello world') // 'hello_world'
 */
export function toSnakeCase(value: string): string {
    return value
        .trim()
        .replace(/([a-z\d])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-zA-Z\d_]/g, '')
        .toLowerCase();
}

/**
 * 截断字符串并附加后缀。
 * 常用于 UI 显示描述、标签等有长度限制的地方。
 *
 * @param value - 待截断的字符串
 * @param maxLength - 最大长度（含后缀）
 * @param suffix - 余文的后缀，默认 '...'
 * @returns 截断后的字符串
 *
 * @example
 * truncate('Hello World', 8)  // 'Hello...'
 * truncate('Hi', 10)          // 'Hi'
 */
export function truncate(value: string, maxLength: number, suffix = '...'): string {
    if (maxLength <= suffix.length) return suffix.slice(0, maxLength);
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength - suffix.length) + suffix;
}
