export type TokenType = 'access' | 'refresh';

export interface JwtClaim {
    sub: string;
    iat: number;
    exp: number;
    jti: string;
    tokenType: TokenType;
}

export interface AccessTokenClaim extends JwtClaim {
    tokenType: 'access';
}

export interface RefreshTokenClaim extends JwtClaim {
    tokenType: 'refresh';
    /** TalosArk 自有刷新会话的稳定 ID。 */
    sid: string;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface PasswordRegistrationCommand {
    username: string;
    email: string;
    password: string;
}

export interface PasswordLoginCommand {
    account: string;
    password: string;
}

/** 通过已完成的二次验证建立 TalosArk 会话的调用方证明。 */
export interface CreateSessionForVerifiedUserCommand {
    userId: string;
}

/** Kernel 跨模块返回的安全本地用户投影，不泄露 Prisma entity。 */
export interface AuthenticatedUser {
    id: string;
    username: string;
    email: string;
}

export interface IdentitySession extends TokenPair {
    user: AuthenticatedUser;
}

/** 进入平台级 Casdoor OIDC 登录流程所需的浏览器跳转地址。 */
export interface BeginOidcLoginResult {
    authorizationUrl: string;
}

/** Casdoor 回调中由传输层接收并交给 IdentityKernel 的参数。 */
export interface CompleteOidcLoginCommand {
    code: string;
    state: string;
}

/** 已登录用户修改本地密码时的凭据。 */
export interface ChangePasswordCommand {
    userId: string;
    currentPassword: string;
    newPassword: string;
}

/** 已完成可信恢复校验后重置本地密码时的凭据。 */
export interface ResetPasswordCommand {
    userId: string;
    newPassword: string;
}
