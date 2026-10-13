import type {
    OidcLoginCallbackBody,
    OidcLoginCallbackResponse,
    OidcStartResponse,
    PasswordRecoveryRequestBody,
    PasswordRecoveryRequestResponse,
    PasswordRecoveryConfirmBody,
    PasswordRecoveryConfirmResponse,
} from '@talos-ark/contracts/auth';
import type { RequestOptions } from '@/platform/http';

export interface AuthDataSource {
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
