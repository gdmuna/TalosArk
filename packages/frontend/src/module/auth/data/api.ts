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
                headers: { 'X-TalosArk-Client': 'browser' },
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
                headers: { 'X-TalosArk-Client': 'browser' },
                body,
                schema: OidcLoginCallbackResponseSchema,
                auth: 'none',
                retry: false,
            });
        },
    };
}
