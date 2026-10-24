/**
 * 将数字按 locale 格式化；不可用数字时返回 fallback。
 */
export function formatNumber(
    value: unknown,
    fallback = '',
    locale = 'zh-CN',
    options?: Intl.NumberFormatOptions
): string {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return fallback;
    return new Intl.NumberFormat(locale, options).format(num);
}
