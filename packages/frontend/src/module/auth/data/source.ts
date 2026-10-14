import type {
    OidcLoginCallbackBody,
    OidcLoginCallbackResponse,
    OidcStartResponse,
    PasswordRecoveryRequestBody,
    PasswordRecoveryRequestResponse,
    PasswordRecoveryConfirmBody,
    PasswordRecoveryConfirmResponse,
    PasswordLoginBody,
    PasswordLoginResponse,
    AccountActivateBody,
    PasswordSetBody,
    SessionRefreshResponse,
} from '@talos-ark/contracts/auth';
import type { RequestOptions } from '@/platform/http';

export interface AuthDataSource {
    passwordLogin(
        body: PasswordLoginBody,
        options?: RequestOptions
    ): Promise<PasswordLoginResponse>;
    activateAccount(body: AccountActivateBody, options?: RequestOptions): Promise<void>;
    setFirstPassword(
        body: PasswordSetBody,
        options?: RequestOptions
    ): Promise<PasswordLoginResponse>;
    refreshSession(options?: RequestOptions): Promise<SessionRefreshResponse>;
    logout(options?: RequestOptions): Promise<void>;
    requestPasswordRecovery(
        body: PasswordRecoveryRequestBody,
        options?: RequestOptions
    ): Promise<PasswordRecoveryRequestResponse>;
    confirmPasswordRecovery(
        body: PasswordRecoveryConfirmBody,
        options?: RequestOptions
    ): Promise<PasswordRecoveryConfirmResponse>;
    startOidcLogin(options?: RequestOptions): Promise<OidcStartResponse>;
    completeOidcLogin(
        body: OidcLoginCallbackBody,
        options?: RequestOptions
    ): Promise<OidcLoginCallbackResponse>;
}
