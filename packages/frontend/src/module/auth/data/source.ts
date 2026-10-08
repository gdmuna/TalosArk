import type {
    OidcLoginCallbackBody,
    OidcLoginCallbackResponse,
    OidcStartResponse,
} from '@talos-ark/contracts/auth';
import type { RequestOptions } from '@/platform/http';

export interface AuthDataSource {
    startOidcLogin(options?: RequestOptions): Promise<OidcStartResponse>;
    completeOidcLogin(
        body: OidcLoginCallbackBody,
        options?: RequestOptions
    ): Promise<OidcLoginCallbackResponse>;
}
