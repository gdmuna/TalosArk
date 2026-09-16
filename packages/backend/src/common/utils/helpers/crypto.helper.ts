/**
 * 加密和哈希工具 - UUID生成、哈希、密码等。
 * 注意：密码哈希建议使用 bcrypt/argon2 等专业库。
 */
import { generateRandomInt } from '../operations/number.operation.js';

import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * 生成随机的十六进制字符串。
 * 常用于会话ID、令牌等。
 *
 * @param length - 生成的字节数，默认16（32个十六进制字符）
 * @returns 十六进制字符串
 *
 * @example
 * generateRandomHex() // 'd4f8a3b2c9e1f5a7...'
 * generateRandomHex(8) // 'a1b2c3d4'
 */
export function generateRandomHex(length: number = 16): string {
    return randomBytes(length).toString('hex');
}

/**
 * 计算字符串的 SHA-1 哈希值（已过时，仅用于兼容性）。
 *
 * @deprecated 使用 hashSHA256 或 hashSHA512 代替
 * @param value - 待哈希的字符串
 * @returns 十六进制哈希值
 */
export function hashSHA1(value: string): string {
    return createHash('sha1').update(value).digest('hex');
}

/**
 * 计算字符串的 SHA-256 哈希值。
 *
 * @param value - 待哈希的字符串
 * @returns 十六进制哈希值
 *
 * @example
 * hashSHA256('password123') // 'ef92b778...'
 */
export function hashSHA256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

/**
 * 计算字符串的 SHA-512 哈希值。
 * 提供比 SHA-256 更高的安全性。
 *
 * @param value - 待哈希的字符串
 * @returns 十六进制哈希值
 */
export function hashSHA512(value: string): string {
    return createHash('sha512').update(value).digest('hex');
}

/**
 * 计算字符串的 MD5 哈希值（已过时，仅用于兼容性）。
 *
 * @deprecated MD5 存在碰撞漏洞，不应用于安全场合
 * @param value - 待哈希的字符串
 * @returns 十六进制哈希值
 */
export function hashMD5(value: string): string {
    return createHash('md5').update(value).digest('hex');
}

/**
 * 生成指定长度的随机字母数字字符串。
 * 常用于验证码、临时密码等。
 *
 * @param length - 生成的字符数，默认10
 * @param charset - 字符集（默认：大小写字母 + 数字）
 * @returns 随机字符串
 *
 * @example
 * generateRandomString(6) // 'aBc1De'
 * generateRandomString(10, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')  // 'ABCDEFGHIJ'
 */
export function generateRandomString(
    length: number = 10,
    charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
    if (length <= 0) return '';
    if (charset.length === 0) throw new RangeError('charset must not be empty');

    const charsetLength = charset.length;
    // 使用 Uint32（4 字节/字符）做拒绝采样：
    // 拒绝率 = (2^32 % charsetLength) / 2^32，对 62 字符集约为 ~4.7e-8，
    // 同时支持字符集长度超过 256 的场景（字节方案在此会无限循环）。
    const UINT32_MAX = 2 ** 32;
    const max = UINT32_MAX - (UINT32_MAX % charsetLength);
    const result: string[] = [];

    while (result.length < length) {
        const needed = length - result.length;
        const buf = randomBytes(needed * 4 + 64);
        for (let i = 0; i + 3 < buf.length && result.length < length; i += 4) {
            const val = buf.readUInt32BE(i);
            if (val < max) {
                result.push(charset[val % charsetLength]);
            }
        }
    }

    return result.join('');
}

/**
 * 生成纯数字的随机字符串（如验证码）。
 *
 * @param length - 生成的数字个数，默认6
 * @returns 数字字符串
 *
 * @example
 * generateRandomDigits() // '123456'
 * generateRandomDigits(4) // '7234'
 */
export function generateRandomDigits(length: number = 6): string {
    return generateRandomString(length, '0123456789');
}

/**
 * 计算对象或字符串的简单哈希值（不加密，用于校验和）。
 * 使用JSON序列化 + SHA-256。
 *
 * @param value - 待哈希的对象或字符串
 * @returns 十六进制哈希值
 *
 * @example
 * const obj = { a: 1, b: 2 };
 * const hash1 = objectHash(obj);
 * const hash2 = objectHash({ a: 1, b: 2 });
 * console.log(hash1 === hash2); // true（相同的内容产生相同的哈希）
 */
export function objectHash(value: any): string {
    const json = typeof value === 'string' ? value : JSON.stringify(value, null, 0);
    return hashSHA256(json);
}

/**
 * 计算字符串的校验和（基于 Luhn 算法）。
 * 常用于银行卡号、身份证验证等。
 *
 * @param value - 数字字符串
 * @returns 校验位（0-9）
 *
 * @example
 * luhnChecksum('79927398713') // 0 (校验位)
 */
export function luhnChecksum(value: string): number {
    const digits = value.split('').reverse();
    let sum = 0;

    for (let i = 0; i < digits.length; i++) {
        let digit = parseInt(digits[i], 10);

        if (i % 2 === 1) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
    }

    return (10 - (sum % 10)) % 10;
}

/**
 * 验证字符串是否符合 Luhn 算法（包含校验位）。
 *
 * @param value - 完整的数字字符串（包含校验位）
 * @returns 是否有效
 *
 * @example
 * verifyLuhn('79927398713') // true
 * verifyLuhn('79927398714') // false
 */
export function verifyLuhn(value: string): boolean {
    if (!/^\d+$/.test(value) || value.length < 2) return false;

    const checksum = luhnChecksum(value.slice(0, -1));
    return checksum === parseInt(value[value.length - 1], 10);
}

/**
 * 生成指定数量的密码和哈希对。
 * 若未提供密码，会自动生成 8-128 字符的随机密码。
 *
 * @param count - 要生成的密码哈希对数量，默认 1
 * @param options - 可选配置
 * @param options.password - 固定密码。若省略则自动生成随机密码
 * @param options.salt - bcrypt salt 轮次（1-31）或已生成的 salt。默认 10
 * @returns 包含 password 和 hash 的对象数组
 *
 * @example
 * // 生成 10 个随机密码的哈希
 * const hashes = await generatePasswordHash(10);
 *
 * // 生成 5 个固定密码 "secret123" 的哈希（cost=12）
 * const hashes = await generatePasswordHash(5, {
 *   password: 'secret123',
 *   salt: 12
 * });
 */
export async function generatePasswordHash(
    count: number = 1,
    options?: {
        password?: string;
        salt?: number | string;
    }
): Promise<{ password: string; hash: string }[]> {
    const tasks: Promise<any>[] = [];
    for (let i = 0; i < count; i++) {
        const task = (async () => {
            const password = options?.password ?? generateRandomString(generateRandomInt(8, 128));
            const hash = await bcrypt.hash(password, options?.salt ?? 10);
            return { password, hash };
        })();
        tasks.push(task);
    }
    return await Promise.all(tasks);
}
