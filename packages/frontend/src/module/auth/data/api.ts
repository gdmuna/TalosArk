import {
    OidcLoginCallbackResponseSchema,
    OidcStartResponseSchema,
    PasswordRecoveryRequestResponseSchema,
    PasswordRecoveryConfirmResponseSchema,
    PasswordLoginResponseSchema,
    SessionRefreshResponseSchema,
} from '@talos-ark/contracts/auth';
import type { HttpClient } from '@/platform/http';
import type { AuthDataSource } from './source';

export function createHttpAuthDataSource(http: HttpClient): AuthDataSource {
    return {
        passwordLogin(body, options = {}) {
            return http.request({
                ...options,
                method: 'POST',
                path: '/auth/password/login',
                headers: { 'X-TalosArk-Client': 'browser' },
                body,
                schema: PasswordLoginResponseSchema,
                auth: 'none',
                retry: false,
            });
        },
        activateAccount(body, options = {}) {
            return http.request({
                ...options,
                method: 'POST',
                path: '/auth/account/activate',
                headers: { 'X-TalosArk-Client': 'browser' },
                body,
                response: 'empty',
                auth: 'none',
                retry: false,
            });
        },
        setFirstPassword(body, options = {}) {
            return http.request({
                ...options,
                method: 'POST',
                path: '/auth/password/set',
                headers: { 'X-TalosArk-Client': 'browser' },
                body,
                schema: PasswordLoginResponseSchema,
                retry: false,
            });
        },
        refreshSession(options = {}) {
            return http.request({
                ...options,
                method: 'POST',
                path: '/auth/session/refresh',
                headers: { 'X-TalosArk-Client': 'browser' },
                body: {},
                schema: SessionRefreshResponseSchema,
                auth: 'none',
                retry: false,
            });
        },
        logout(options = {}) {
            return http.request({
                ...options,
                method: 'POST',
                path: '/auth/session/logout',
                headers: { 'X-TalosArk-Client': 'browser' },
                body: {},
                response: 'empty',
                auth: 'none',
                retry: false,
            });
        },
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
