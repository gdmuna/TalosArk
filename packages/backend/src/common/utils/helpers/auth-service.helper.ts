import { FastifyRequest } from 'fastify';

// TODO(identity): 刷新令牌 Cookie 的完整策略将在 IdentityKernel 落地后由其配置拥有。
// 这里保留历史 HTTP helper 的默认 Cookie 名称，避免让通用 token 提取依赖已移除的 auth.config。
const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

/**
 * 从 Bearer 格式字符串中提取 token。
 *
 * @param payload 形如 `Bearer <token>` 的认证字符串。
 * @returns 提取到的 token；若格式不匹配则返回 `null`。
 */
export function extractToken(payload: string) {
    const match = payload.match(/^Bearer[ ](.+)$/);
    return match ? match[1] : null;
}

/**
 * 从请求头中提取 Access Token。
 *
 * @param request Fastify 请求对象。
 * @returns 提取到的 Bearer Token；若不存在则返回 null。
 * @example
 * const token = authService.extractAccessTokenFromRequest(request);
 */
export function extractAccessTokenFromRequest(request: FastifyRequest): string | null {
    const authHeader = request.headers?.authorization;
    if (!authHeader) return null;
    return extractToken(authHeader);
}

/**
 * 从请求 Cookie 中提取 Refresh Token。
 *
 * @param request Fastify 请求对象。
 * @returns 提取到的 Refresh Token；若不存在则返回 null。
 * @example
 * const refreshToken = authService.extractRefreshTokenFromRequest(request);
 */
export function extractRefreshTokenFromRequest(request: FastifyRequest): string | null {
    return request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || null;
}
