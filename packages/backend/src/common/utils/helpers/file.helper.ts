import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 读取相对于 `process.cwd()` 的文本文件内容。
 *
 * @param relativePath - 相对于项目根目录的文件路径，如 `'config/keys/dev-private.pem'`
 * @returns 文件内容（已 trim）；读取失败时返回空字符串
 *
 * @example
 * readFile('config/keys/dev-private.pem') // '-----BEGIN PRIVATE KEY-----\n...'
 * readFile('not-exist.txt')               // ''
 */
export function readFile(relativePath: string): string {
    try {
        return readFileSync(resolve(process.cwd(), relativePath), 'utf-8').trim();
    } catch {
        return '';
    }
}
