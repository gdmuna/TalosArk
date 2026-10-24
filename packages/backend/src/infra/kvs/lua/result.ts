/** 校验 Lua 返回的字符串数组，避免脚本结果异常时静默丢弃数据。 */
export function parseStringArrayResult(value: unknown): string[] {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new TypeError('Valkey script returned an invalid string array.');
    }

    return value;
}
