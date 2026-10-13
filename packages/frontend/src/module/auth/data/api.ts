import {
    OidcLoginCallbackResponseSchema,
    OidcStartResponseSchema,
    PasswordRecoveryRequestResponseSchema,
    PasswordRecoveryConfirmResponseSchema,
} from '@talos-ark/contracts/auth';
import type { HttpClient } from '@/platform/http';
import type { AuthDataSource } from './source';

export function createHttpAuthDataSource(http: HttpClient): AuthDataSource {
    return {
        requestPasswordRecovery(body, options = {}) {
            return http.request({
                ...options,
                method: 'POST',
                path: '/auth/password/recovery/request',
                headers: { 'X-TalosArk-Client': 'browser' },
                body,
                schema: PasswordRecoveryRequestResponseSchema,
                auth: 'none',
                retry: false,
            });
        },
        confirmPasswordRecovery(body, options = {}) {
            return http.request({
                ...options,
                method: 'POST',
                path: '/auth/password/recovery/confirm',
                headers: { 'X-TalosArk-Client': 'browser' },
                body,
                schema: PasswordRecoveryConfirmResponseSchema,
                auth: 'none',
                retry: false,
            });
        },
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
