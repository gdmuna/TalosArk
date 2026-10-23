import { AuthenticationError, HttpError, isResponseValidationError } from '@/platform/http';

export function authErrorMessage(cause: unknown, fallback: string): string {
    if (isResponseValidationError(cause)) return '';
    if (cause instanceof AuthenticationError && cause.reason === 'changed')
        return '登录状态已变更，请重新操作。';
    if (cause instanceof AuthenticationError && cause.reason === 'busy')
        return '会话正在刷新，请稍后重试。';
    if (!(cause instanceof HttpError)) return fallback;
    if (cause.status === 429) return '尝试过于频繁，请稍后再试。';
    switch (cause.code) {
        case 'AUTH_CREDENTIALS_INVALID':
            return '账号或密码不正确。';
        case 'AUTH_ACTIVATION_INVALID':
            return '激活链接无效或已过期，请联系开户管理员。';
        case 'AUTH_PASSWORD_PRESENT':
            return '账户已有本地密码，可通过找回密码重设。';
        case 'AUTH_PASSWORD_REJECTED':
            return '请换一个不易被猜到的密码。';
        case 'AUTH_REAUTHENTICATION_REQUIRED':
            return '请重新通过企业 SSO 登录，再设置本地密码。';
        default:
            return cause.status === 403 ? '当前访问地址或账户无权执行此操作。' : fallback;
    }
}
