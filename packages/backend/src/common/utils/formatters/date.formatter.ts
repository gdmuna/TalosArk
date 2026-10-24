function asValidDate(input: Date | string | number): Date | null {
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

/**
 * 按 locale 输出“日期”展示字符串（不含时间）。
 */
export function formatDate(
    input: Date | string | number,
    locale = 'zh-CN',
    fallback = '',
    options?: Intl.DateTimeFormatOptions
): string {
    const date = asValidDate(input);
    if (!date) return fallback;

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...options,
    }).format(date);
}

/**
 * 按 locale 输出“日期+时间”展示字符串。
 */
export function formatDateTime(
    input: Date | string | number,
    locale = 'zh-CN',
    fallback = '',
    options?: Intl.DateTimeFormatOptions
): string {
    const date = asValidDate(input);
    if (!date) return fallback;

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        ...options,
    }).format(date);
}
