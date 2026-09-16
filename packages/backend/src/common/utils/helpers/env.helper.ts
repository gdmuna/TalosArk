import { config, DotenvConfigOptions } from '@dotenvx/dotenvx-ops';
import { resolve } from 'path';

/**
 * 根据传入的后缀加载对应的 .env 文件到 process.env
 * 默认后缀为环境变量 NODE_ENV 的值，若 NODE_ENV 未设置则默认为 'development'
 * @param suffix - 环境文件后缀（如 'development', 'test', 'production'），默认为 NODE_ENV 或 'development'
 * @param options - dotenv config 的额外配置选项（如 debug: false 关闭日志输出）
 * @returns void
 * @remark 可在 options 中传入 path 以覆盖默认的 .env 文件路径
 * @example
 * // 加载 .env.production 文件
 * loadEnv('production');
 *
 * // 加载 .env.test 文件且禁用 debug 输出
 * loadEnv('test', { debug: false });
 *
 * // 使用环境变量自动选择
 * loadEnv();
 */
export function loadEnv(
    suffix: string = process.env.NODE_ENV ?? 'development',
    options?: DotenvConfigOptions
) {
    const path = resolve(process.cwd(), `.env.${suffix}`);
    config({
        path,
        ...options,
    });
}
