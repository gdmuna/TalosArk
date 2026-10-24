/**
 * OpenAPI JSON 生成脚本
 *
 * 从正在运行的后端实例获取 OpenAPI schema，保存到
 * packages/docsite/api-reference/openapi.json，供本地文档构建和 Docker 镜像构建使用。
 *
 * 用法：
 *   pnpm docs:gen-openapi                           # 使用默认地址 http://localhost:3000
 *   BACKEND_URL=http://localhost:3001 pnpm docs:gen-openapi  # 自定义后端地址
 *
 * 前提条件：后端服务必须已启动（pnpm start:dev）
 */

import { writeFileSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

export async function exportOpenApi(baseUrl: string, output: string): Promise<void> {
    const url = new URL('api-doc-json', `${baseUrl.replace(/\/+$/, '')}/`);
    console.error(`Fetching OpenAPI schema from ${url.origin}${url.pathname}...`);

    let response: Response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    } catch (err) {
        throw new Error(
            `Cannot fetch OpenAPI from ${url.origin}. Make sure the backend is running.`,
            { cause: err }
        );
    }

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status} ${response.statusText} - ${url.origin}${url.pathname}`
        );
    }

    const json: unknown = await response.json();
    if (
        !json ||
        typeof json !== 'object' ||
        !('openapi' in json) ||
        typeof json.openapi !== 'string' ||
        !json.openapi.startsWith('3.') ||
        !('info' in json) ||
        !json.info ||
        typeof json.info !== 'object' ||
        !('title' in json.info) ||
        typeof json.info.title !== 'string' ||
        !('version' in json.info) ||
        typeof json.info.version !== 'string' ||
        !('paths' in json) ||
        !json.paths ||
        typeof json.paths !== 'object' ||
        Array.isArray(json.paths)
    ) {
        throw new Error('Backend did not return an OpenAPI 3 document');
    }

    mkdirSync(dirname(output), { recursive: true });
    const temporaryPath = `${output}.${process.pid}.tmp`;
    const content = `${JSON.stringify(json, null, 2)}\n`;
    try {
        writeFileSync(temporaryPath, content);
        renameSync(temporaryPath, output);
    } finally {
        rmSync(temporaryPath, { force: true });
    }

    console.info(`OpenAPI saved to ${output} (${Buffer.byteLength(content)} bytes)`);
}
