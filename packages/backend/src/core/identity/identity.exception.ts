import { AuthException, ResourceException } from '@/platform/errors/client.exception.js';
import { InfraException } from '@/platform/errors/app.exception.js';
import { RegisterException } from '@/platform/errors/exception-registry.js';

export const AuthExceptionCode = {
    USER_DUPLICATE: 'AUTH_USER_DUPLICATE',
    CREDENTIALS_INVALID: 'AUTH_CREDENTIALS_INVALID',
    TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
    TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
    OIDC_LOGIN_FAILED: 'AUTH_OIDC_LOGIN_FAILED',
    OIDC_UNAVAILABLE: 'AUTH_OIDC_UNAVAILABLE',
} as const;

@RegisterException({
    code: AuthExceptionCode.USER_DUPLICATE,
    statusCode: 409,
    message: '用户已存在',
    description: '该邮箱或用户名已被注册，请更换后重试',
    retryable: false,
    logLevel: 'info',
    causes: ['该用户名已被其他账户使用', '该邮箱已被其他账户注册'],
    hint: '使用不同的用户名和邮箱重新注册，或通过登录接口找回已有账户',
})
export class DuplicateUserException extends ResourceException {}

@RegisterException({
    code: AuthExceptionCode.CREDENTIALS_INVALID,
    statusCode: 401,
    message: '用户名或密码错误',
    description: '提供的账号或密码不匹配任何已知账户，请检查后重试',
    retryable: false,
    logLevel: 'info',
    hint: '检查用户名/邮箱拼写及大小写是否正确，并确认密码与注册时一致',
})
export class InvalidCredentialsException extends AuthException {}

@RegisterException({
    code: AuthExceptionCode.TOKEN_INVALID,
    statusCode: 401,
    message: 'Token 无效或已过期',
    description: '提供的 Token 格式不正确、签名验证失败或已过期，请重新登录',
    retryable: false,
    logLevel: 'info',
    causes: ['Token 已超过有效期', 'Token 签名与服务器密钥不匹配', 'Token 格式不符合 JWT 规范'],
    hint: '调用 `POST /auth/refresh-token` 使用刷新令牌换取新的访问令牌，或重新登录',
})
export class InvalidTokenException extends AuthException {}

@RegisterException({
    code: AuthExceptionCode.TOKEN_MISSING,
    statusCode: 401,
    message: '缺少访问令牌',
    description: '请求头中未提供有效的 Bearer Token，请先登录',
    retryable: false,
    logLevel: 'info',
    hint: '在请求头中添加 `Authorization: Bearer <accessToken>`，令牌可通过 `POST /auth/login` 或 `POST /auth/register` 获取',
})
export class MissingTokenException extends AuthException {}

@RegisterException({
    code: AuthExceptionCode.OIDC_LOGIN_FAILED,
    statusCode: 401,
    message: '第三方登录校验失败',
    description: 'OIDC 回调的 state、PKCE、nonce、签名身份声明或本地身份绑定未能通过 TalosArk 校验',
    retryable: false,
    logLevel: 'info',
    causes: ['登录事务已过期或已使用', '回调参数不匹配', '外部身份令牌校验失败'],
    hint: '从登录入口重新发起第三方登录，不要重复使用旧的回调链接',
})
export class OidcLoginFailedException extends AuthException {}

@RegisterException({
    code: AuthExceptionCode.OIDC_UNAVAILABLE,
    statusCode: 503,
    message: '第三方登录暂不可用',
    description: '平台未完成 Casdoor OIDC 回调地址或证书配置，暂时无法发起外部身份登录',
    retryable: false,
    logLevel: 'error',
    hint: '配置完整的 CASDOOR_* OIDC 环境变量，并在 Casdoor 应用中登记回调地址',
})
export class OidcUnavailableException extends InfraException {}

export default {
    DuplicateUserException,
    InvalidCredentialsException,
    InvalidTokenException,
    MissingTokenException,
    OidcLoginFailedException,
    OidcUnavailableException,
};
