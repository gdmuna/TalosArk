import {
    OidcLoginCallbackResponseSchema,
    OidcStartResponseSchema,
} from '@talos-ark/contracts/auth';
import type { HttpClient } from '@/platform/http';
import type { AuthDataSource } from './source';

export function createHttpAuthDataSource(http: HttpClient): AuthDataSource {
    return {
        startOidcLogin(options = {}) {
            return http.request({
                ...options,
                method: 'POST',
                path: '/auth/oidc/start',
                schema: OidcStartResponseSchema,
                auth: 'none',
                retry: false,
            });
        },
        completeOidcLogin(body, options = {}) {
            return http.request({
                ...options,
                method: 'POST',
                path: '/auth/oidc/login-callback',
                body,
                schema: OidcLoginCallbackResponseSchema,
                auth: 'none',
                retry: false,
            });
        },
    };
}
